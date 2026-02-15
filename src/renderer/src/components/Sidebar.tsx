/**
 * VOIDRA — Sidebar Navigasyon
 */

import {
    LayoutDashboard,
    Users,
    Database,
    Settings as SettingsIcon,
    Shield
} from 'lucide-react';
import type { PageId } from '../App';

interface SidebarProps {
    activePage: PageId;
    onNavigate: (page: PageId) => void;
}

// Navigasyon menü öğeleri
const NAV_ITEMS: Array<{ id: PageId; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'profiles', label: 'Profiller', icon: <Shield size={20} /> },
    { id: 'pool', label: 'Başvuru Havuzu', icon: <Database size={20} /> },
    { id: 'settings', label: 'Ayarlar', icon: <SettingsIcon size={20} /> }
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
    return (
        <aside className="sidebar">
            {/* Navigasyon */}
            <nav className="sidebar__nav">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        className={`sidebar__link ${activePage === item.id ? 'sidebar__link--active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                        id={`nav-${item.id}`}
                    >
                        <span className="sidebar__link-icon">{item.icon}</span>
                        <span className="sidebar__link-text">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar__footer">
                <div className="sidebar__version">
                    <Users size={12} style={{ display: 'inline', marginRight: 4, opacity: 0.5 }} />
                    VOIDRA v0.1.0
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
