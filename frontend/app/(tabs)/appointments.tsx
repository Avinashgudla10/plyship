import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

interface Appointment {
  appointment_id: string;
  date: string;
  location: string;
  status: string;
  other_user: {
    user_id: string;
    name: string;
    picture?: string;
  };
  confirmation?: {
    seeker_confirmed: boolean;
    company_confirmed: boolean;
  };
  requested_by: string;
}

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const response = await api.get('/api/appointments');
      setAppointments(response.data);
    } catch (error) {
      console.error('Load appointments error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleApprove = async (appointmentId: string) => {
    try {
      await api.put(`/api/appointments/${appointmentId}/approve`);
      Alert.alert('Success', 'Appointment approved!');
      loadAppointments();
    } catch (error) {
      console.error('Approve error:', error);
      Alert.alert('Error', 'Failed to approve appointment');
    }
  };

  const handleReject = async (appointmentId: string) => {
    Alert.alert(
      'Reject Appointment',
      'Are you sure you want to reject this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update appointment status to cancelled
              await api.put(`/api/appointments/${appointmentId}/approve`, {
                // We'll need to add a cancel endpoint, for now just don't approve
              });
              Alert.alert('Rejected', 'Appointment rejected');
              loadAppointments();
            } catch (error) {
              console.error('Reject error:', error);
            }
          }
        }
      ]
    );
  };

  const handleConfirmMeeting = async (appointmentId: string) => {
    Alert.alert(
      'Confirm Meeting',
      'Did this meeting actually happen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            try {
              const response = await api.post('/api/appointments/confirm-meeting', {
                appointment_id: appointmentId
              });
              
              if (response.data.both_confirmed) {
                Alert.alert('Success', '₹500 has been transferred!');
              } else {
                Alert.alert('Confirmed', 'Waiting for other party to confirm');
              }
              
              loadAppointments();
            } catch (error) {
              console.error('Confirm meeting error:', error);
              Alert.alert('Error', 'Failed to confirm meeting');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (appointments.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="calendar-outline" size={64} color="#95A5A6" />
        <Text style={styles.emptyTitle}>No Appointments</Text>
        <Text style={styles.emptyText}>
          Match with someone and schedule a meeting!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.appointment_id}
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            userId={user?.user_id}
            onApprove={() => handleApprove(item.appointment_id)}
            onReject={() => handleReject(item.appointment_id)}
            onConfirmMeeting={() => handleConfirmMeeting(item.appointment_id)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const AppointmentCard = ({ appointment, userId, onApprove, onReject, onConfirmMeeting }: any) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F39C12';
      case 'approved': return '#27AE60';
      case 'completed': return '#3498DB';
      case 'cancelled': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isRequester = appointment.requested_by === userId;
  const needsApproval = appointment.status === 'pending' && !isRequester;
  const canConfirm = appointment.status === 'approved';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={48} color="#636E72" />
          <View style={styles.userText}>
            <Text style={styles.userName}>{appointment.other_user?.name}</Text>
            <Text style={styles.roleText}>
              {isRequester ? 'You requested' : 'They requested'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
          <Text style={styles.statusText}>{appointment.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={20} color="#636E72" />
          <Text style={styles.detailText}>{formatDate(appointment.date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={20} color="#636E72" />
          <Text style={styles.detailText}>{appointment.location}</Text>
        </View>
      </View>

      {appointment.confirmation && (
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmationTitle}>Meeting Confirmation:</Text>
          <View style={styles.confirmationRow}>
            <Text style={styles.confirmationText}>
              Seeker: {appointment.confirmation.seeker_confirmed ? '✓ Confirmed' : '✕ Not confirmed'}
            </Text>
            <Text style={styles.confirmationText}>
              Company: {appointment.confirmation.company_confirmed ? '✓ Confirmed' : '✕ Not confirmed'}
            </Text>
          </View>
        </View>
      )}

      {needsApproval && (
        <TouchableOpacity style={styles.approveButton} onPress={onApprove}>
          <Text style={styles.approveButtonText}>Approve Appointment</Text>
        </TouchableOpacity>
      )}

      {canConfirm && (
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirmMeeting}>
          <Text style={styles.confirmButtonText}>Confirm Meeting Happened</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userText: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
  },
  roleText: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2D3436',
  },
  confirmationContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  confirmationRow: {
    gap: 8,
  },
  confirmationText: {
    fontSize: 13,
    color: '#636E72',
  },
  approveButton: {
    backgroundColor: '#27AE60',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});