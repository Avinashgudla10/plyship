import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';

const STYLES = ['Modern', 'Traditional', 'Minimalist', 'Industrial', 'Contemporary', 'Rustic'];
const PROJECT_TYPES = ['Residential', 'Commercial'];

export default function SeekerSetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    project_title: '',
    location: '',
    budget_min: '',
    budget_max: '',
    styles: [] as string[],
    project_type: 'Residential',
    timeline: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/api/seeker/profile');
      if (response.data) {
        setFormData({
          project_title: response.data.project_title || '',
          location: response.data.location || '',
          budget_min: response.data.budget_min?.toString() || '',
          budget_max: response.data.budget_max?.toString() || '',
          styles: response.data.styles || [],
          project_type: response.data.project_type || 'Residential',
          timeline: response.data.timeline || '',
        });
      }
    } catch (error) {
      console.log('No existing profile');
    }
  };

  const toggleStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter(s => s !== style)
        : [...prev.styles, style]
    }));
  };

  const handleSave = async () => {
    if (!formData.project_title || !formData.location || !formData.budget_min || !formData.budget_max) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.styles.length === 0) {
      Alert.alert('Error', 'Please select at least one style preference');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/seeker/profile', {
        project_title: formData.project_title,
        location: formData.location,
        budget_min: parseInt(formData.budget_min),
        budget_max: parseInt(formData.budget_max),
        styles: formData.styles,
        project_type: formData.project_type,
        timeline: formData.timeline,
        photos: []
      });

      Alert.alert('Success', 'Profile saved successfully!', [
        { text: 'OK', onPress: () => {
          // Navigate to matches tab
          router.replace('/(tabs)');
        }}
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Setup Your Project</Text>
          <Text style={styles.subtitle}>Tell companies about your interior needs</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Project Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.project_title}
              onChangeText={(text) => setFormData({ ...formData, project_title: text })}
              placeholder="e.g., 3 BHK Modern Living Room"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              placeholder="e.g., Mumbai, Maharashtra"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={styles.label}>Min Budget (\u20b9) *</Text>
              <TextInput
                style={styles.input}
                value={formData.budget_min}
                onChangeText={(text) => setFormData({ ...formData, budget_min: text })}
                placeholder="500000"
                keyboardType="numeric"
                placeholderTextColor="#95A5A6"
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={styles.label}>Max Budget (\u20b9) *</Text>
              <TextInput
                style={styles.input}
                value={formData.budget_max}
                onChangeText={(text) => setFormData({ ...formData, budget_max: text })}
                placeholder="1000000"
                keyboardType="numeric"
                placeholderTextColor="#95A5A6"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Style Preferences *</Text>
            <View style={styles.chipContainer}>
              {STYLES.map(style => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.chip,
                    formData.styles.includes(style) && styles.chipSelected
                  ]}
                  onPress={() => toggleStyle(style)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formData.styles.includes(style) && styles.chipTextSelected
                    ]}
                  >
                    {style}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Project Type</Text>
            <View style={styles.chipContainer}>
              {PROJECT_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    formData.project_type === type && styles.chipSelected
                  ]}
                  onPress={() => setFormData({ ...formData, project_type: type })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      formData.project_type === type && styles.chipTextSelected
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Timeline</Text>
            <TextInput
              style={styles.input}
              value={formData.timeline}
              onChangeText={(text) => setFormData({ ...formData, timeline: text })}
              placeholder="e.g., 3 months"
              placeholderTextColor="#95A5A6"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6E9',
  },
  chipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  chipText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
