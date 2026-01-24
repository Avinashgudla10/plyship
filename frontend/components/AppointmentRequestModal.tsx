import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface AppointmentRequestModalProps {
  visible: boolean;
  onClose: () => void;
  targetUser: {
    user_id: string;
    name: string;
  };
  onSuccess: () => void;
}

export default function AppointmentRequestModal({
  visible,
  onClose,
  targetUser,
  onSuccess,
}: AppointmentRequestModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!date || !time || !location) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Combine date and time
    const dateTimeString = `${date}T${time}:00`;

    try {
      setLoading(true);
      await api.post('/api/appointments', {
        target_user_id: targetUser.user_id,
        date: dateTimeString,
        location: location,
      });

      Alert.alert('Success', 'Appointment request sent!');
      setDate('');
      setTime('');
      setLocation('');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Appointment request error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to request appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Request Appointment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#2D3436" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.infoText}>
              Request a meeting with <Text style={styles.boldText}>{targetUser.name}</Text>
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                <Ionicons name="calendar" size={16} /> Date *
              </Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD (e.g., 2025-01-15)"
                placeholderTextColor="#95A5A6"
              />
              <Text style={styles.helperText}>Format: YYYY-MM-DD</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                <Ionicons name="time" size={16} /> Time *
              </Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM (e.g., 14:30)"
                placeholderTextColor="#95A5A6"
              />
              <Text style={styles.helperText}>Format: HH:MM (24-hour)</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                <Ionicons name="location" size={16} /> Location *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter meeting location"
                placeholderTextColor="#95A5A6"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#3498DB" />
              <Text style={styles.infoBoxText}>
                The other party will receive your appointment request and can approve or decline it.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Sending...' : 'Send Request'}
              </Text>
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    padding: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 24,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#2D3436',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DFE6E9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 4,
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F4FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
