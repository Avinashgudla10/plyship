import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="home" size={60} color="#FF6B6B" />
          </View>
          <Text style={styles.appName}>PLYSHIP</Text>
          <Text style={styles.tagline}>Connect with Interior Experts</Text>
        </View>

        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="search"
            title="Find Matches"
            description="Get matched with the best interior companies"
          />
          <FeatureItem
            icon="calendar"
            title="Book Meetings"
            description="Schedule and manage appointments easily"
          />
          <FeatureItem
            icon="wallet"
            title="Earn Rewards"
            description="Get ₹500 for every confirmed meeting"
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={login}>
          <Ionicons name="logo-google" size={24} color="#FFFFFF" style={styles.googleIcon} />
          <Text style={styles.loginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const FeatureItem = ({ icon, title, description }: any) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <Ionicons name={icon} size={28} color="#FF6B6B" />
    </View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#636E72',
  },
  featuresContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  googleIcon: {
    marginRight: 12,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    color: '#95A5A6',
    fontSize: 12,
    marginTop: 16,
  },
});