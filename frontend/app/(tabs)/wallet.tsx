import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface Wallet {
  balance: number;
  currency: string;
}

interface Transaction {
  transaction_id: string;
  amount: number;
  type: string;
  status: string;
  created_at: string;
  from_user_id?: string;
  to_user_id: string;
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const [walletRes, transactionsRes] = await Promise.all([
        api.get('/api/users/wallet'),
        api.get('/api/wallet/transactions')
      ]);
      
      setWallet(walletRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Load wallet error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  const handleTopup = () => {
    Alert.alert(
      'Add Money',
      'This feature requires Razorpay integration. Please add your Razorpay keys to the backend .env file to enable payments.',
      [{ text: 'OK' }]
    );
  };

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw Money',
      'You can withdraw money only after providing advance payment proof to a company.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Balance</Text>
        <Text style={styles.balanceAmount}>
          {wallet?.currency} {wallet?.balance.toFixed(2)}
        </Text>
        
        <View style={styles.actionButtons}>
          {user?.active_role === 'company' && (
            <TouchableOpacity style={styles.topupButton} onPress={handleTopup}>
              <Ionicons name="add-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Add Money</Text>
            </TouchableOpacity>
          )}
          
          {user?.active_role === 'seeker' && wallet && wallet.balance > 0 && (
            <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
              <Ionicons name="arrow-down-circle" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#3498DB" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>How it works</Text>
          {user?.active_role === 'seeker' ? (
            <Text style={styles.infoText}>
              You earn ₹500 for every confirmed meeting with a company. Money can be withdrawn after providing advance payment proof.
            </Text>
          ) : (
            <Text style={styles.infoText}>
              Add money to your wallet. ₹500 will be transferred to seekers for every confirmed meeting.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#95A5A6" />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <TransactionItem
              key={transaction.transaction_id}
              transaction={transaction}
              userId={user?.user_id}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const TransactionItem = ({ transaction, userId }: any) => {
  const isCredit = transaction.to_user_id === userId;
  const isDebit = transaction.from_user_id === userId;

  const getIcon = () => {
    if (transaction.type === 'meeting_reward') return 'gift';
    if (transaction.type === 'topup') return 'add-circle';
    if (transaction.type === 'withdrawal') return 'arrow-down-circle';
    return 'swap-horizontal';
  };

  const getColor = () => {
    if (transaction.status === 'pending') return '#F39C12';
    if (transaction.status === 'failed') return '#E74C3C';
    if (isCredit) return '#27AE60';
    if (isDebit) return '#E74C3C';
    return '#3498DB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: getColor() + '20' }]}>
        <Ionicons name={getIcon()} size={24} color={getColor()} />
      </View>
      
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionType}>
          {transaction.type.replace('_', ' ').toUpperCase()}
        </Text>
        <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
        <Text style={styles.transactionStatus}>{transaction.status}</Text>
      </View>
      
      <Text style={[styles.transactionAmount, { color: getColor() }]}>
        {isCredit ? '+' : isDebit ? '-' : ''}₹{transaction.amount.toFixed(2)}
      </Text>
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
  },
  balanceCard: {
    backgroundColor: '#FF6B6B',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  topupButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  withdrawButton: {
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#E8F4FD',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
  },
  transactionsSection: {
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 48,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#95A5A6',
    marginTop: 12,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#95A5A6',
    marginBottom: 2,
  },
  transactionStatus: {
    fontSize: 12,
    color: '#636E72',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});