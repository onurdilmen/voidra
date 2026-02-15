/**
 * VOIDRA — Ana Uygulama Bileşeni
 */

import { useState } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Profiles from './pages/Profiles';
import DataPool from './pages/DataPool';
import Settings from './pages/Settings';

// Sayfa tipleri
export type PageId = 'dashboard' | 'profiles' | 'pool' | 'settings';

function App() {
    const [activePage, setActivePage] = useState<PageId>('dashboard');

    // Aktif sayfayı render et
    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <Dashboard />;
            case 'profiles':
                return <Profiles />;
            case 'pool':
                return <DataPool />;
            case 'settings':
                return <Settings />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <>
            <Titlebar />
            <div className="app">
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main className="main-content">
                    {renderPage()}
                </main>
            </div>
        </>
    );
}

export default App;
