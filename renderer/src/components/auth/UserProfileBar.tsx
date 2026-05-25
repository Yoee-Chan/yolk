import React, {useState} from 'react';
import {Avatar, Button, Dropdown} from 'antd';
import {LoginOutlined, LogoutOutlined, UserOutlined} from '@ant-design/icons';
import type {MenuProps} from 'antd';
import {useAuth} from '../../context/AuthContext';
import AuthModal from './AuthModal';
import ProfileEditModal from './ProfileEditModal';

type UserProfileBarProps = {
    onUpgrade?: () => void;
};

export default function UserProfileBar({onUpgrade}: UserProfileBarProps) {
    const {user, loading, logout} = useAuth();
    const [authOpen, setAuthOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    if (loading) {
        return (
            <div className="user-profile-card user-profile-card--loading">...</div>
        );
    }

    if (!user) {
        return (
            <>
                <div className="user-profile-card">
                    <Button
                        type="default"
                        icon={<LoginOutlined/>}
                        block
                        className="user-profile-card__sign-in"
                        onClick={() => setAuthOpen(true)}
                    >
                        登录
                    </Button>
                </div>
                <AuthModal open={authOpen} onClose={() => setAuthOpen(false)}/>
            </>
        );
    }

    const menuItems: MenuProps['items'] = [
        {
            key: 'logout',
            label: '退出登录',
            icon: <LogoutOutlined/>,
            onClick: () => logout(),
        },
    ];

    return (
        <>
            <Dropdown menu={{items: menuItems}} trigger={['contextMenu']}>
                <div className="user-profile-card">
                    <button
                        type="button"
                        className="user-profile-card__main"
                        onClick={() => setProfileOpen(true)}
                        title="编辑资料"
                    >
                        <Avatar
                            size={32}
                            src={user.avatarUrl || undefined}
                            icon={<UserOutlined/>}
                            className="user-profile-card__avatar"
                        />
                        <div className="user-profile-card__info">
                            <span className="user-profile-card__name">{user.nickname}</span>
                            <span className="user-profile-card__plan">免费版</span>
                        </div>
                    </button>
                    {onUpgrade ? (
                        <button
                            type="button"
                            className="user-profile-card__upgrade"
                            onClick={onUpgrade}
                        >
                            升级
                        </button>
                    ) : null}
                </div>
            </Dropdown>
            <ProfileEditModal open={profileOpen} onClose={() => setProfileOpen(false)}/>
        </>
    );
}
