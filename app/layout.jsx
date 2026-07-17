import './globals.css';

export const metadata = {
  title: 'Armaf Performance Intelligence',
  description: 'Unified organic and paid media intelligence for Armaf USA.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
