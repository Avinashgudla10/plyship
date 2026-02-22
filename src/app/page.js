'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SwipeDeck from '../components/SwipeDeck';
import MatchOverlay from '../components/MatchOverlay';
import ProfileDetail from '../components/ProfileDetail';
import MatchesView from '../components/MatchesView';
import { ChatListView, ChatView } from '../components/ChatView';
import ProfileView, {
  EditProfileView,
  LikedProfilesView,
  NotificationsView,
  PrivacyView,
  SettingsView,
  HelpView
} from '../components/ProfileView';
import WalletView from '../components/WalletView';
import MeetingsView from '../components/MeetingsView';
import ProjectsView from '../components/ProjectsView';
import LandingPage from '../components/LandingPage';
import { Leaf, Compass, Heart, MessageCircle, User, RefreshCw } from 'lucide-react';

const ADMIN_PHONES = ['+918465834152'];

export default function Home() {
  const router = useRouter();
  const { user, loading, getSwipeProfiles, likeProfile, passProfile, getMatches, getIncomingLikes, acceptMatch, refuseMatch, getChats } = useAuth();
  const [match, setMatch] = useState(null);
  const [detailProfile, setDetailProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('explore');
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chats, setChats] = useState([]);
  const [likedProfiles, setLikedProfiles] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [profileSubPage, setProfileSubPage] = useState(null);

  // Redirect logic for admin and incomplete profiles
  useEffect(() => {
    if (!loading && user) {
      // Admin users go straight to dashboard
      if (ADMIN_PHONES.includes(user.phone)) {
        router.replace('/admin');
        return;
      }
      if (!user.role) {
        // User logged in but no role - they need to signup properly
        router.push('/signup');
      } else if (!user.profileComplete) {
        router.push('/profile-setup');
      }
    }
  }, [user, loading, router]);

  // Load profiles when user is ready or when switching to explore tab
  useEffect(() => {
    const loadProfiles = async () => {
      if (user && user.profileComplete && activeTab === 'explore') {
        const swipeProfiles = await getSwipeProfiles();
        setProfiles(swipeProfiles);
        console.log('🔄 Loaded', swipeProfiles.length, 'profiles for swiping');
      }
    };
    loadProfiles();
  }, [user, activeTab, getSwipeProfiles]);

  // Load matches when switching to matches tab
  useEffect(() => {
    const loadMatches = async () => {
      if (user && user.profileComplete && activeTab === 'matches') {
        const [userMatches, incomingLikes] = await Promise.all([
          getMatches(),
          getIncomingLikes(),
        ]);
        setMatches(userMatches);
        setPendingRequests(incomingLikes);
        console.log('💕 Loaded', userMatches.length, 'matches,', incomingLikes.length, 'pending requests');
      }
    };
    loadMatches();
  }, [user, activeTab, getMatches, getIncomingLikes]);

  // Load chats when switching to messages tab + real-time updates
  useEffect(() => {
    let unsubscribes = [];
    let isMounted = true;

    const setupChatListeners = async () => {
      if (!user || !user.profileComplete || activeTab !== 'messages') return;

      // Initial load
      const userChats = await getChats();
      if (!isMounted) return;
      setChats(userChats);
      console.log('💬 Loaded', userChats.length, 'chats');

      // Set up real-time listeners on each chat's metadata doc
      const { onSnapshot, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      userChats.forEach(chat => {
        const unsub = onSnapshot(doc(db, 'chats', chat.id), (snap) => {
          if (!isMounted || !snap.exists()) return;
          const data = snap.data();
          setChats(prev => prev.map(c =>
            c.id === chat.id
              ? { ...c, lastMessage: data.lastMessage || c.lastMessage, lastMessageAt: data.lastMessageAt || c.lastMessageAt }
              : c
          ));
        });
        unsubscribes.push(unsub);
      });
    };

    setupChatListeners();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, activeTab, getChats]);

  // Show landing page for non-authenticated users (must be after all hooks)
  if (!loading && !user) {
    return <LandingPage />;
  }

  if (loading || !user || !user.profileComplete) return null;

  const handleMatch = async (profile, direction) => {
    if (direction === 'tap') {
      setDetailProfile(profile);
      return;
    }

    // Handle like (right swipe or up swipe)
    if (direction === 'right' || direction === 'up') {
      // Track locally for liked profiles view
      setLikedProfiles(prev => {
        if (prev.find(p => p.id === profile.id)) return prev;
        return [...prev, profile];
      });

      // Store like in Firebase and check for match
      const result = await likeProfile(profile);

      if (result.isMatch) {
        // It's a mutual match! Show the overlay
        console.log('🎉 Showing match overlay for:', profile.name || profile.profile?.companyName);
        setMatch(profile);
        // Add to matches list
        setMatches(prev => {
          if (prev.find(m => m.id === profile.id)) return prev;
          return [...prev, profile];
        });
      }
    }

    // Handle pass (left swipe)
    if (direction === 'left') {
      // Record pass in Firebase so profile never shows again
      await passProfile(profile);
    }
  };

  const handleCloseMatch = () => {
    setMatch(null);
  };

  const handleChat = () => {
    setMatch(null);
    setActiveTab('messages');
  };

  const refreshProfiles = async () => {
    const swipeProfiles = await getSwipeProfiles();
    setProfiles(swipeProfiles);
  };

  const handleChatClick = (profile) => {
    setSelectedChat(profile);
    setActiveTab('messages');
  };

  const handleProfileNavigate = (page) => {
    setProfileSubPage(page);
  };

  // Unread count feature - simplified to avoid render loops
  // Will fetch on-demand when user opens messages tab

  const navItems = [
    { id: 'explore', icon: Compass, label: 'Explore', badge: 0 },
    { id: 'matches', icon: Heart, label: 'Matches', badge: 0 },
    { id: 'messages', icon: MessageCircle, label: 'Chat', badge: 0 },
    { id: 'profile', icon: User, label: 'Profile', badge: 0 },
  ];

  // Render content based on active tab
  const renderContent = () => {
    // Handle profile sub-pages
    if (activeTab === 'profile' && profileSubPage) {
      switch (profileSubPage) {
        case 'wallet':
          return <WalletView onBack={() => setProfileSubPage(null)} />;
        case 'meetings':
          return <MeetingsView onBack={() => setProfileSubPage(null)} />;
        case 'projects':
          return <ProjectsView onBack={() => setProfileSubPage(null)} />;
        case 'edit':
          return <EditProfileView onBack={() => setProfileSubPage(null)} />;
        case 'liked':
          return <LikedProfilesView onBack={() => setProfileSubPage(null)} likedProfiles={likedProfiles} />;
        case 'notifications':
          return <NotificationsView onBack={() => setProfileSubPage(null)} />;
        case 'privacy':
          return <PrivacyView onBack={() => setProfileSubPage(null)} />;
        case 'settings':
          return <SettingsView onBack={() => setProfileSubPage(null)} />;
        case 'help':
          return <HelpView onBack={() => setProfileSubPage(null)} />;
        default:
          return <ProfileView onNavigate={handleProfileNavigate} />;
      }
    }

    switch (activeTab) {
      case 'explore':
        return profiles.length > 0 ? (
          <SwipeDeck profiles={profiles} onMatch={handleMatch} userRole={user?.role} />
        ) : (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 32,
          }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: 'var(--pastel-green)',
                border: '1px solid var(--pastel-mint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              {user?.role === 'SEEKER' ? (
                <Compass size={36} color="var(--primary)" />
              ) : (
                <User size={36} color="var(--primary)" />
              )}
            </motion.div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}>
              No {user?.role === 'SEEKER' ? 'companies' : 'clients'} yet
            </h2>
            <p style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 24,
            }}>
              {user?.role === 'SEEKER'
                ? 'Interior companies will appear here once they sign up.'
                : 'Interior seekers will appear here once they sign up.'
              }
            </p>
            <motion.button
              onClick={refreshProfiles}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '14px 28px',
                borderRadius: 14,
                background: 'var(--gradient-primary)',
                border: 'none',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-glow-soft)',
              }}
            >
              <RefreshCw size={18} />
              Refresh
            </motion.button>
          </div>
        );

      case 'matches':
        return (
          <MatchesView
            matches={matches}
            pendingRequests={pendingRequests}
            onChatClick={handleChatClick}
            onAccept={async (request) => {
              const result = await acceptMatch(request.id);
              if (result.success) {
                setPendingRequests(prev => prev.filter(r => r.id !== request.id));
                setMatches(prev => [...prev, {
                  id: request.id,
                  matchedUserId: request.id,
                  matchedUserName: request.name,
                  matchedUserRole: request.role,
                  matchedUserProfile: request.profile,
                  matchedAt: new Date().toISOString(),
                }]);
              }
            }}
            onRefuse={async (request) => {
              const result = await refuseMatch(request.id);
              if (result.success) {
                setPendingRequests(prev => prev.filter(r => r.id !== request.id));
              }
            }}
            viewerRole={user?.role}
          />
        );

      case 'messages':
        if (selectedChat) {
          return (
            <ChatView
              chat={selectedChat}
              onBack={() => setSelectedChat(null)}
              onNavigate={(page) => {
                setSelectedChat(null);
                setActiveTab('profile');
                setProfileSubPage(page);
              }}
            />
          );
        }
        return (
          <ChatListView
            chats={chats}
            onChatSelect={(chat) => setSelectedChat(chat)}
            user={user}
          />
        );

      case 'profile':
        return <ProfileView onNavigate={handleProfileNavigate} />;

      default:
        return null;
    }
  };

  // Determine if we should hide header/nav
  const isFullScreen = (activeTab === 'messages' && selectedChat) ||
    (activeTab === 'profile' && profileSubPage);

  return (
    <main style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* Minimal Top Header */}
      {!isFullScreen && (
        <header style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'white',
          borderBottom: '1px solid var(--border-light)',
          zIndex: 10,
          minHeight: 44,
          position: 'relative',
        }}>
          {/* Logo */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Leaf size={15} color="white" />
          </div>

          {/* Centered Tab Title */}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            {activeTab === 'explore' && 'Explore'}
            {activeTab === 'matches' && 'Matches'}
            {activeTab === 'messages' && 'Messages'}
            {activeTab === 'profile' && 'Profile'}
          </span>

          {/* Clickable Avatar → Profile/Settings */}
          <motion.div
            onClick={() => { setActiveTab('profile'); setProfileSubPage(null); }}
            whileTap={{ scale: 0.9 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: user?.profile?.avatar ? `url(${user.profile.avatar}) center/cover` : 'var(--pastel-green)',
              border: '1.5px solid var(--pastel-mint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {!user?.profile?.avatar && <User size={14} color="var(--primary-hover)" />}
          </motion.div>
        </header>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        padding: activeTab === 'explore' && !isFullScreen ? '12px 16px 0' : '0',
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (selectedChat?.id || '') + (profileSubPage || '')}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            style={{ height: '100%' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {!isFullScreen && (
        <nav style={{
          padding: '12px 24px 20px',
          background: 'white',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 10,
        }}>
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== 'messages') setSelectedChat(null);
                if (item.id !== 'profile') setProfileSubPage(null);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 12px',
                borderRadius: 12,
                background: activeTab === item.id ? 'var(--pastel-green)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--pastel-green)',
                    borderRadius: 12,
                    border: '1px solid var(--pastel-mint)',
                  }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                size={22}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  color: activeTab === item.id ? 'var(--primary-hover)' : 'var(--text-muted)',
                  transition: 'color 0.2s',
                }}
                fill={activeTab === item.id && (item.id === 'matches') ? 'var(--primary-hover)' : 'none'}
              />
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-muted)',
                position: 'relative',
                zIndex: 1,
                transition: 'color 0.2s',
              }}>
                {item.label}
              </span>
              {/* Badge for unread messages */}
              {item.badge > 0 && activeTab !== item.id && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: item.id === 'messages' ? '#EF4444' : 'var(--primary)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </motion.button>
          ))}
        </nav>
      )}

      <AnimatePresence>
        {match && (
          <MatchOverlay
            matchedProfile={match}
            onClose={handleCloseMatch}
            onChat={handleChat}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailProfile && (
          <ProfileDetail
            profile={detailProfile}
            onClose={() => setDetailProfile(null)}
            onLike={() => handleMatch(detailProfile, 'right')}
            onPass={() => handleMatch(detailProfile, 'left')}
            viewerRole={user?.role}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
