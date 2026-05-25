import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
    cloudApi,
    getStoredToken,
    setStoredToken,
    type AuthResult,
    type UserProfile,
} from '../api/cloudApi';

type AuthContextValue = {
    user: UserProfile | null;
    loading: boolean;
    login: (account: string, password: string) => Promise<void>;
    registerEmail: (email: string, password: string, nickname?: string) => Promise<void>;
    registerPhone: (phone: string, password: string, nickname?: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    updateProfile: (payload: {nickname?: string; avatarUrl?: string | null}) => Promise<void>;
    updatePassword: (oldPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyAuth(setUser: (u: UserProfile | null) => void, result: AuthResult) {
    setStoredToken(result.token);
    setUser(result.user);
}

export function AuthProvider({children}: {children: React.ReactNode}) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        const token = getStoredToken();
        if (!token) {
            setUser(null);
            return;
        }
        const profile = await cloudApi.me();
        setUser(profile);
    }, []);

    useEffect(() => {
        refreshUser()
            .catch(() => {
                setStoredToken(null);
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, [refreshUser]);

    const login = useCallback(async (account: string, password: string) => {
        const result = await cloudApi.login(account.trim(), password);
        applyAuth(setUser, result);
    }, []);

    const registerEmail = useCallback(
        async (email: string, password: string, nickname?: string) => {
            const result = await cloudApi.registerEmail(email.trim(), password, nickname);
            applyAuth(setUser, result);
        },
        []
    );

    const registerPhone = useCallback(
        async (phone: string, password: string, nickname?: string) => {
            const result = await cloudApi.registerPhone(phone.trim(), password, nickname);
            applyAuth(setUser, result);
        },
        []
    );

    const logout = useCallback(() => {
        setStoredToken(null);
        setUser(null);
    }, []);

    const updateProfile = useCallback(
        async (payload: {nickname?: string; avatarUrl?: string | null}) => {
            const profile = await cloudApi.updateProfile(payload);
            setUser(profile);
        },
        []
    );

    const updatePassword = useCallback(async (oldPassword: string, newPassword: string) => {
        await cloudApi.updatePassword(oldPassword, newPassword);
    }, []);

    const value = useMemo(
        () => ({
            user,
            loading,
            login,
            registerEmail,
            registerPhone,
            logout,
            refreshUser,
            updateProfile,
            updatePassword,
        }),
        [
            user,
            loading,
            login,
            registerEmail,
            registerPhone,
            logout,
            refreshUser,
            updateProfile,
            updatePassword,
        ]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
