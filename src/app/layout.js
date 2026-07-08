import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'PLYSHIP',
  description: 'Connect Home Interior Seekers with Interior Companies',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom (accessibility / WCAG 1.4.4). Previously locked at 1x with
  // userScalable:false, which blocks users who need to zoom.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  // Brand green so the mobile status bar / PWA chrome matches the app instead of
  // flashing white against the green splash and headers.
  themeColor: '#16A34A',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
