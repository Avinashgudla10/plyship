import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout, toggleRole } = useAuth();
  const router = useRouter();
  const [isCompany, setIsCompany] = React.useState(user?.active_role === 'company');

  const handleRoleToggle = async (value: boolean) => {
    try {
      const newRole = value ? 'company' : 'seeker';
      await toggleRole(newRole);
      setIsCompany(value);
      
      Alert.alert(
        'Role Changed',
        `You are now in ${newRole} mode. Don't forget to set up your ${newRole} profile!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle role');
      setIsCompany(!value);
    }
  };

  const handleEditProfile = () => {
    const route = user?.active_role === 'seeker'
      ? '/profile/seeker-setup'
      : '/profile/company-setup';
    router.push(route);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: user?.picture || 'https://via.placeholder.com/100' }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.roleToggleContainer}>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleLabel}>I'm a Company</Text>
            <Text style={styles.roleSubtext}>
              {isCompany ? 'Looking for projects' : 'Looking for interior help'}
            </Text>
          </View>
          <Switch
            value={isCompany}
            onValueChange={handleRoleToggle}
            trackColor={{ false: '#DFE6E9', true: '#FF6B6B' }}
            thumbColor={isCompany ? '#FFFFFF' : '#FFFFFF'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <MenuItem
          icon="person"
          title="Edit Profile"
          onPress={handleEditProfile}
        />
        
        <MenuItem
          icon="star"
          title="My Ratings"
          onPress={() => Alert.alert('Coming Soon', 'Ratings feature coming soon!')}
        />
        
        <MenuItem
          icon="document-text"
          title="Terms & Conditions"
          onPress={() => Alert.alert('Terms', 'Terms & Conditions')}
        />
        
        <MenuItem
          icon="shield-checkmark"
          title="Privacy Policy"
          onPress={() => Alert.alert('Privacy', 'Privacy Policy')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>App Name</Text>
          <Text style={styles.infoValue}>PLYSHIP</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#E74C3C" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ for Interior Enthusiasts</Text>
      </View>
    </ScrollView>
  );
}

const MenuItem = ({ icon, title, onPress }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Ionicons name={icon} size={24} color="#636E72" />
    <Text style={styles.menuItemText}>{title}</Text>
    <Ionicons name="chevron-forward" size={24} color="#95A5A6" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#636E72',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#95A5A6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  roleSubtext: {
    fontSize: 14,
    color: '#636E72',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    marginLeft: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#636E72',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  footer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#95A5A6',
  },
});