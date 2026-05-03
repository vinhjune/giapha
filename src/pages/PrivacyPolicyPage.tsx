export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8 prose prose-sm">
        <h1>Privacy Policy for Gia pha dong ho</h1>
        <p><strong>Last Updated: May 3, 2026</strong></p>
        <p>
          Your privacy is important to us. This Privacy Policy explains how{' '}
          <strong>Gia pha dong ho</strong> ("we," "our," or "the App") handles your
          information when you use our web application.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>Google Sign-In (Authentication)</h3>
        <p>
          We use <strong>Google OAuth</strong> to allow you to log into the App securely.
          When you sign in, we access basic profile information provided by Google:
        </p>
        <ul>
          <li><strong>Your Name:</strong> To personalize your experience within the App.</li>
          <li><strong>Your Email Address:</strong> To identify your account and manage access permissions.</li>
          <li><strong>Profile Picture:</strong> To display your avatar within the App interface.</li>
        </ul>

        <h3>Google Drive (Data Storage)</h3>
        <p>The App uses the <strong>Google Drive API</strong> to store and retrieve your family tree data. Specifically:</p>
        <ul>
          <li>We create a folder named <code>giapha</code> in your Google Drive and store a file named <code>giapha.json</code> inside it.</li>
          <li>This file contains the family tree data that you enter into the App.</li>
          <li>We read and write only to files created by this App within that folder.</li>
          <li>We may update file sharing permissions if you choose to make your family tree publicly viewable.</li>
        </ul>

        <h2>2. How We Use Your Data</h2>
        <ul>
          <li><strong>Authentication data</strong> (name, email, profile picture) is used strictly to identify you and manage access to the App.</li>
          <li><strong>Google Drive data</strong> is used solely to save and load your family tree. Your data remains in <strong>your own Google Drive account</strong> — we do not copy or store it on any external server.</li>
          <li>We <strong>do not</strong> sell, rent, or trade your personal information to third parties.</li>
          <li>We <strong>do not</strong> use your data for marketing or advertising purposes.</li>
        </ul>

        <h2>3. Data Storage and Third Parties</h2>
        <ul>
          <li><strong>Your family tree data</strong> is stored entirely within your own Google Drive account. We have no independent copy of it.</li>
          <li><strong>Session tokens</strong> are stored locally in your browser (localStorage) and expire automatically.</li>
          <li>We <strong>do not</strong> share your data with any third-party services beyond Google's own APIs.</li>
        </ul>

        <h2>4. Data Retention and Deletion</h2>
        <ul>
          <li><strong>Drive data:</strong> Your <code>giapha.json</code> file lives in your Google Drive. You can delete it at any time directly from Google Drive.</li>
          <li><strong>Session data:</strong> Logging out clears your session token from the browser.</li>
          <li>
            <strong>Revoking access:</strong> You can revoke the App's access to your Google account at any time via{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              Google Account Permissions
            </a>.
          </li>
          <li><strong>Contact for deletion:</strong> For any other data concerns, contact us at <strong>hoangthevinh.htv@gmail.com</strong>.</li>
        </ul>

        <h2>5. Google API Disclosure</h2>
        <p>
          Gia pha dong ho's use and transfer to any other app of information received from Google APIs
          will adhere to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Service User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          The App accesses Google Drive <strong>only</strong> to store and retrieve the user's own
          family tree data (<code>giapha.json</code>). This data is not used for any purpose other
          than operating the App's core functionality.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please reach out to:<br />
          <strong>Email:</strong> hoangthevinh.htv@gmail.com
        </p>
      </div>
    </div>
  )
}
