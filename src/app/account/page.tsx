'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('sb_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!data.user) {
        localStorage.removeItem('sb_token');
        localStorage.removeItem('sb_user');
        router.push('/login');
        return;
      }
      
      setUser(data.user);
    } catch (err) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('sb_token');
    
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'logout' })
      });
    } catch (err) {
      // Ignore logout errors
    }

    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      return;
    }

    setDeleting(true);
    const token = localStorage.getItem('sb_token');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete-account',
          confirmation: deleteConfirmation
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to delete account');
        setDeleting(false);
        return;
      }

      localStorage.removeItem('sb_token');
      localStorage.removeItem('sb_user');
      alert('Account deleted successfully');
      router.push('/login');
    } catch (err) {
      alert('Network error. Please try again.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Account Settings</h1>
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ← Back to App
          </button>
        </div>

        {/* User Info Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <div className="text-white">{user.name}</div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <div className="text-white">{user.email}</div>
            </div>
            
            <div>
              <label className="block text-sm text-slate-400 mb-1">Member Since</label>
              <div className="text-white">
                {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>
          
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-950/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
          <p className="text-slate-400 text-sm mb-4">
            Once you delete your account, there is no going back. All your data will be permanently deleted.
          </p>
          
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-2">Delete Your Account?</h3>
            <p className="text-slate-400 text-sm mb-4">
              This action cannot be undone. All your beats, notes, and data will be permanently deleted.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm text-slate-300 mb-2">
                Type <span className="text-red-400 font-mono">DELETE MY ACCOUNT</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="DELETE MY ACCOUNT"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                disabled={deleting}
                className="flex-1 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}