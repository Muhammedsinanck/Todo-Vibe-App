import React, { useState } from 'react';
import { auth } from '../db/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Target } from 'lucide-react';

export const AuthLogin: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to authenticate.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg text-theme-text flex flex-col items-center justify-center p-4 selection:bg-theme-accent selection:text-white transition-colors duration-500">
            <div className="w-full max-w-md p-8 glass-panel backdrop-blur-2xl shadow-xl flex flex-col items-center">
                <div className="w-16 h-16 bg-theme-glass backdrop-blur-sm rounded-2xl shadow-sm border border-theme-glass-border flex items-center justify-center mb-6">
                    <Target className="w-8 h-8 text-theme-accent" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-theme-text-inv mb-2">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-theme-muted mb-8 text-center">
                    {isLogin
                        ? 'Sign in to sync your tasks across all devices.'
                        : 'Sign up to get started with your synced workspace.'}
                </p>

                {error && (
                    <div className="w-full p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-theme-muted mb-1 ml-1" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full px-4 py-3 border border-theme-glass-border rounded-xl leading-5 bg-theme-input-bg backdrop-blur-sm placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent focus:bg-theme-glass-solid sm:text-sm transition-all shadow-sm text-theme-text"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-theme-muted mb-1 ml-1" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            className="block w-full px-4 py-3 border border-theme-glass-border rounded-xl leading-5 bg-theme-input-bg backdrop-blur-sm placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent focus:bg-theme-glass-solid sm:text-sm transition-all shadow-sm text-theme-text"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-theme-accent hover:bg-theme-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-theme-accent hover:text-theme-accent-hover transition-colors font-medium"
                    >
                        {isLogin
                            ? "Don't have an account? Sign up"
                            : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};
