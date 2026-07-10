import './globals.css';

export const metadata = {
  title: 'Armaf Paid Media Dashboard',
  description: 'Interactive paid media reporting dashboard for Armaf USA.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
