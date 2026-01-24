import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useRouter } from 'expo-router';
import AppointmentRequestModal from '../../components/AppointmentRequestModal';

const { width } = Dimensions.get('window');

interface Match {
  user_id: string;
  name: string;
  picture?: string;
  match_score: number;
  company_name?: string;
  project_title?: string;
  description?: string;
  location?: string;
  budget_min?: number;
  budget_max?: number;
}

export default function MatchesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [potentialMatches, setPotentialMatches] = useState<Match[]>([]);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'discover' | 'matched'>('discover');
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.active_role]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if user has profile
      const profileEndpoint = user?.active_role === 'seeker' 
        ? '/api/seeker/profile' 
        : '/api/company/profile';
      
      const profileRes = await api.get(profileEndpoint);
      setHasProfile(!!profileRes.data);
      
      if (profileRes.data) {
        // Load matches
        const [potentialRes, matchedRes] = await Promise.all([
          api.get('/api/matches/potential'),
          api.get('/api/matches/my-matches')
        ]);
        
        setPotentialMatches(potentialRes.data);
        setMyMatches(matchedRes.data);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLike = async (targetUserId: string) => {
    try {
      const response = await api.post('/api/matches/like', {
        target_user_id: targetUserId
      });
      
      // Remove from potential matches
      setPotentialMatches(prev => prev.filter(m => m.user_id !== targetUserId));
      
      if (response.data.matched) {
        // Reload matched list
        const matchedRes = await api.get('/api/matches/my-matches');
        setMyMatches(matchedRes.data);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handlePass = (targetUserId: string) => {
    setPotentialMatches(prev => prev.filter(m => m.user_id !== targetUserId));
  };

  const handleSetupProfile = () => {
    router.push('/profile/role-selection');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  if (!hasProfile) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-add" size={64} color="#95A5A6" />
        <Text style={styles.emptyTitle}>Complete Your Profile</Text>
        <Text style={styles.emptyText}>
          Set up your {user?.active_role === 'seeker' ? 'project' : 'company'} profile to start matching
        </Text>
        <TouchableOpacity style={styles.setupButton} onPress={handleSetupProfile}>
          <Text style={styles.setupButtonText}>Setup Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matched' && styles.activeTab]}
          onPress={() => setActiveTab('matched')}
        >
          <Text style={[styles.tabText, activeTab === 'matched' && styles.activeTabText]}>
            Matched ({myMatches.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' ? (
        potentialMatches.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search" size={64} color="#95A5A6" />
            <Text style={styles.emptyTitle}>No More Matches</Text>
            <Text style={styles.emptyText}>Check back later for new matches!</Text>
          </View>
        ) : (
          <FlatList
            data={potentialMatches}
            keyExtractor={(item) => item.user_id}
            renderItem={({ item }) => (
              <MatchCard
                match={item}
                onLike={() => handleLike(item.user_id)}
                onPass={() => handlePass(item.user_id)}
                role={user?.active_role}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      ) : (
        myMatches.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="heart-dislike" size={64} color="#95A5A6" />
            <Text style={styles.emptyTitle}>No Matches Yet</Text>
            <Text style={styles.emptyText}>Start liking profiles to create matches!</Text>
          </View>
        ) : (
          <FlatList
            data={myMatches}
            keyExtractor={(item) => item.user_id}
            renderItem={({ item }) => (
              <MatchedCard match={item} role={user?.active_role} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      )}
    </View>
  );
}

const MatchCard = ({ match, onLike, onPass, role }: any) => (
  <View style={styles.card}>
    {match.has_liked_you && (
      <View style={styles.likedYouBadge}>
        <Ionicons name="heart" size={16} color="#FFFFFF" />
        <Text style={styles.likedYouText}>Liked You!</Text>
      </View>
    )}
    
    <View style={styles.cardHeader}>
      <Image
        source={{ uri: match.picture || 'https://via.placeholder.com/100' }}
        style={styles.avatar}
      />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{match.name}</Text>
        {role === 'seeker' ? (
          <Text style={styles.cardSubtitle}>{match.company_name}</Text>
        ) : (
          <Text style={styles.cardSubtitle}>{match.project_title}</Text>
        )}
      </View>
      <View style={styles.matchScoreBadge}>
        <Text style={styles.matchScoreText}>{Math.round(match.match_score)}%</Text>
      </View>
    </View>

    {role === 'seeker' && match.description && (
      <Text style={styles.description} numberOfLines={2}>
        {match.description}
      </Text>
    )}

    {role === 'company' && (
      <View style={styles.projectDetails}>
        <Text style={styles.detailText}>
          <Ionicons name="location" size={14} /> {match.location}
        </Text>
        <Text style={styles.detailText}>
          <Ionicons name="cash" size={14} /> ₹{match.budget_min?.toLocaleString()} - ₹{match.budget_max?.toLocaleString()}
        </Text>
      </View>
    )}

    <View style={styles.cardActions}>
      <TouchableOpacity style={styles.passButton} onPress={onPass}>
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.likeButton} onPress={onLike}>
        <Ionicons name="heart" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  </View>
);

const MatchedCard = ({ match, role }: any) => {
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  return (
    <>
      <View style={styles.matchedCard}>
        <Image
          source={{ uri: match.picture || 'https://via.placeholder.com/60' }}
          style={styles.matchedAvatar}
        />
        <View style={styles.matchedInfo}>
          <Text style={styles.matchedName}>{match.name}</Text>
          {role === 'seeker' ? (
            <Text style={styles.matchedSubtitle}>{match.company_name}</Text>
          ) : (
            <Text style={styles.matchedSubtitle}>{match.project_title}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.appointmentButton}
          onPress={() => setShowAppointmentModal(true)}
        >
          <Ionicons name="calendar" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <AppointmentRequestModal
        visible={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
        targetUser={{
          user_id: match.user_id,
          name: match.name,
        }}
        meetingLocation={match.meeting_location || ''}
        onSuccess={() => {
          // Optionally refresh the appointments list
        }}
      />
    </>
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
    marginBottom: 24,
  },
  setupButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B6B',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#95A5A6',
  },
  activeTabText: {
    color: '#FF6B6B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  likedYouBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    zIndex: 1,
  },
  likedYouText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#636E72',
  },
  matchScoreBadge: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  matchScoreText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 12,
    lineHeight: 20,
  },
  projectDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  passButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#95A5A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  appointmentButton: {
    backgroundColor: '#FF6B6B',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  matchedInfo: {
    flex: 1,
  },
  matchedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  matchedSubtitle: {
    fontSize: 14,
    color: '#636E72',
  },
});