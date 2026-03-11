import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/tokens';
import { PrimaryButton, SecondaryButton } from './button';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Presents a focused confirmation step before irreversible or high-risk rider actions.
export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmTone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.actions}>
            <PrimaryButton
              label={confirmLabel}
              loading={loading}
              tone={confirmTone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
            <SecondaryButton label={cancelLabel} onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: theme.radius.hero,
    borderTopRightRadius: theme.radius.hero,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.layout.cardPadding,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.layout.inlineGap,
  },
  title: {
    fontSize: theme.typography.section,
    lineHeight: theme.typography.lineHeight.section,
    fontWeight: '800',
    color: theme.colors.text,
  },
  description: {
    fontSize: theme.typography.body,
    lineHeight: theme.typography.lineHeight.body,
    color: theme.colors.textSecondary,
  },
  actions: {
    gap: theme.layout.inlineGap,
    marginTop: theme.spacing.sm,
  },
});
