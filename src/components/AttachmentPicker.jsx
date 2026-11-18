import React, {useEffect, useRef, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useApp} from '../state/AppContext';
import {DOCUMENT_TYPES} from '../domain/attachments';
import {pickAttachments, cleanupAttachment} from '../services/attachments';
import {Button, Card, Message, Paragraph, SectionTitle} from '../ui/components';
import {colors} from '../ui/theme';

export default function AttachmentPicker({patient, onUploaded}) {
  const {session, attachFiles, showNotice} = useApp();
  const [entries, setEntries] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [progress, setProgress] = useState('');
  const files = useRef([]); const mounted = useRef(true); const sessionKey = useRef(session.key);
  const setFiles = value => { files.current = value; setEntries([...value]); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; files.current.forEach(entry => { entry.cancelled = true; if (entry.cancelUpload) entry.cancelUpload(); cleanupAttachment(entry); }); }; }, []);
  const pick = async source => {
    if (session.mode === 'demo') { showNotice({title: 'Sample attachment', message: 'In a connected account, choose files or photograph a document, select its category and upload it to this patient. Demo cases never upload files.'}); return; }
    setBusy(true); setError('');
    try {
      const picked = await pickAttachments(source);
      if (!mounted.current || sessionKey.current !== session.key) { await Promise.all(picked.map(cleanupAttachment)); return; }
      if (files.current.length + picked.length > 10 || (patient.additionalFiles?.length || 0) + files.current.length + picked.length > 50) {
        await Promise.all(picked.map(cleanupAttachment)); throw new Error('Select at most 10 files at a time, with at most 50 documents per patient.');
      }
      setFiles([...files.current, ...picked]);
    } catch (failure) { if (mounted.current) setError(failure.message || 'Unable to select an attachment.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const upload = async () => {
    setBusy(true); setError(''); setProgress('Preparing attachments…');
    try {
      await attachFiles(patient.id, files.current, (entry, patch) => {
        Object.assign(entry, patch);
        if (mounted.current) { setEntries([...files.current]); setProgress(patch.state === 'attaching' ? 'Attaching uploaded document…' : `Uploading ${Math.min(100, patch.progress || 0)}%`); }
      });
      if (mounted.current) { setFiles([]); setProgress('Attachments added.'); }
      await onUploaded();
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || 'Unable to upload. Please retry.');
        const attached = files.current.filter(entry => entry.attached);
        await Promise.all(attached.map(cleanupAttachment));
        setFiles(files.current.filter(entry => !entry.attached)); setProgress('');
        if (attached.length) await onUploaded();
      }
    } finally { if (mounted.current) setBusy(false); }
  };
  return <Card style={{gap: 15}}>
    <SectionTitle title="Attach documents" subtitle="Choose files, photos or photograph a document for this patient." />
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
      <Button title="Choose files" icon="attach-outline" variant="secondary" disabled={busy} onPress={() => pick('files')} />
      <Button title="Take photo" icon="camera-outline" variant="secondary" disabled={busy} onPress={() => pick('camera')} />
      <Button title="Photo library" icon="images-outline" variant="secondary" disabled={busy} onPress={() => pick('photos')} />
    </View>
    <Paragraph style={{fontSize: 11}}>PDF, Word, PowerPoint, text, spreadsheets and images. Up to 25 MB each; PowerPoint up to 500 MB. Maximum 10 files per upload.</Paragraph>
    {entries.map(entry => <View key={entry.id} style={{gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14}}>
      <Text style={{color: colors.ink, fontWeight: '600'}}>{entry.name}</Text>
      <Paragraph style={{fontSize: 11}}>{(entry.size / 1024 / 1024).toFixed(1)} MB{entry.state ? ` · ${entry.state === 'failed' ? 'Upload needs retry' : entry.state}` : ''}</Paragraph>
      <Text style={{color: colors.ink, fontSize: 12}}>Document category</Text>
      <View accessibilityRole="radiogroup" style={{flexDirection: 'row', flexWrap: 'wrap', gap: 7}}>{DOCUMENT_TYPES.map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${label} for ${entry.name}`} accessibilityState={{checked: entry.type === value, disabled: busy}} disabled={busy} onPress={() => { entry.type = value; setEntries([...files.current]); }} style={{padding: 10, borderWidth: 1, borderColor: entry.type === value ? colors.gold : colors.line, borderRadius: 8, backgroundColor: entry.type === value ? colors.goldLight : '#FFF'}}><Text style={{fontSize: 11, color: colors.ink}}>{label}</Text></Pressable>)}</View>
      {!!entry.error && <Message>{entry.error}</Message>}
      <Button title={`Remove ${entry.name}`} variant="quiet" disabled={busy} onPress={async () => { await cleanupAttachment(entry); setFiles(files.current.filter(file => file !== entry)); }} />
    </View>)}
    {!!error && <Message>{error}</Message>}
    {!!progress && <Paragraph accessibilityLiveRegion="polite" style={{fontSize: 12}}>{progress}</Paragraph>}
    {!!entries.length && <Button title={entries.some(entry => entry.state === 'failed') ? 'Retry upload' : 'Upload attachments'} icon="cloud-upload-outline" busy={busy} disabled={busy || entries.some(entry => !entry.type)} onPress={upload} />}
  </Card>;
}
