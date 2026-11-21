import { ILegalPage } from './legal-page.layout'
import {
  LEGAL_APP_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DEVELOPER,
  LEGAL_LOCATION,
  LEGAL_MINIMUM_AGE
} from './legal.constants'

const contact = `<a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>`

export const PRIVACY_PAGE: ILegalPage = {
  title: 'Privacy Policy',
  body: `
<p>${LEGAL_APP_NAME} is a free app for discovering and organizing movies, TV shows, anime, games and books. ${LEGAL_DEVELOPER}, an independent developer based in ${LEGAL_LOCATION}, operates the service.</p>

<h2>Data we collect</h2>
<ul>
<li><strong>Account and sign-in.</strong> We use your email address, username, password hash and session records to create your account and authenticate you. The web app uses a cookie to keep you signed in.</li>
<li><strong>Activity in the app.</strong> Depending on the features you use, this can include profile details, library entries, ratings, reviews, collections and friend connections. Other people can view content shared publicly.</li>
<li><strong>Technical and support information.</strong> We process IP addresses and request information to deliver the service, limit abuse and troubleshoot errors. If you email support, we use your email address and the contents of your message to respond.</li>
<li><strong>Mobile notifications.</strong> If you enable push notifications in a supported mobile client, we use the device's push token and send notification information through Expo.</li>
</ul>

<h2>AI recommendations and Taste DNA</h2>
<p>When you use a personalized AI feature, we send a selection of information about your tastes to OpenRouter and the model provider that handles the request. That may include titles from your library, genres, ratings, whether you have finished a title, and preferences you enter for a recommendation. We may save generated results, such as your Taste DNA, so you can return to them. If you make your profile public, a saved Taste DNA may be visible there.</p>
<p>See the <a href="https://openrouter.ai/privacy">OpenRouter Privacy Policy</a> for details about its handling of requests.</p>

<h2>Third-party services</h2>
<ul>
<li>Oracle Cloud hosts the backend and database. Cloudflare routes and helps protect requests to the service.</li>
<li>Catalog services provide title information and images. To look up a title, we may send search terms or title identifiers to the relevant provider. See <a href="/attribution">Attribution</a> for the list of providers.</li>
</ul>
<p>${LEGAL_APP_NAME} does not show ads, use third-party product analytics or sell personal data.</p>

<h2>Retention and deletion</h2>
<p>We keep account data while you have an account. You can delete your account from the app where account deletion is available, or contact us for help. Deletion removes your account and related user records from the live database. Backup copies used for recovery may still contain those records until the copies are deleted or replaced. We keep support records and technical logs as needed to respond to requests, troubleshoot and protect the service.</p>

<h2>Age eligibility</h2>
<p>${LEGAL_APP_NAME} is intended for adults aged ${LEGAL_MINIMUM_AGE} or older. If you believe a minor has provided personal information through the service, contact us so we can review the report and remove the information as appropriate.</p>

<h2>Contact</h2>
<p>For privacy questions or to request access, correction or deletion of your data, email ${contact}.</p>`
}

export const SUPPORT_PAGE: ILegalPage = {
  title: 'Support',
  body: `
<p>For help with ${LEGAL_APP_NAME}, email ${contact}. Include a short description of the issue and the page where it happened. Keep passwords and sign-in tokens out of your message.</p>

<h2>Common questions</h2>
<h3>How do I delete my account?</h3>
<p>Use Delete account in your profile if your client offers it. You can also email us from the address linked to your account if you need help deleting it or regaining access.</p>
<h3>Why do my recommendations or Taste DNA look off?</h3>
<p>These features use AI and rely on the titles and ratings in your library. Results can be incomplete or inaccurate. If something looks wrong, tell us which feature you used and what you expected to see.</p>
<p>Read the <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a>.</p>`
}

export const TERMS_PAGE: ILegalPage = {
  title: 'Terms of Use',
  body: `
<p>${LEGAL_APP_NAME} is a free service operated by ${LEGAL_DEVELOPER} in ${LEGAL_LOCATION}. These terms apply to your use of the service.</p>

<h2>Who can use ${LEGAL_APP_NAME}</h2>
<p>The service is intended for users in the United States. You must be at least ${LEGAL_MINIMUM_AGE} years old to create an account or use the service. Catalog entries and recommendations may include mature themes.</p>

<h2>Accounts and content</h2>
<p>Keep your account credentials secure. You are responsible for the content you publish and must have the right to share it. Do not post unlawful, abusive or infringing material, impersonate another person, or interfere with the service. We may remove content or suspend accounts that violate these terms.</p>

<h2>Catalog and AI results</h2>
<p>Title information and images come from external sources and belong to their respective owners. See <a href="/attribution">Attribution</a> for details. AI recommendations and Taste DNA are provided for entertainment and may contain errors. The service is provided as available, and catalog entries and features may change.</p>

<h2>Privacy and support</h2>
<p>Our <a href="/privacy">Privacy Policy</a> explains how we handle your data and account deletion. For questions about these terms or to report a problem, visit <a href="/support">Support</a> or email ${contact}.</p>`
}

export const ATTRIBUTION_PAGE: ILegalPage = {
  title: 'Attribution',
  body: `
<p>${LEGAL_APP_NAME} uses data from the following services.</p>
<ul>
<li><strong>TMDB:</strong> This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
<li><strong>RAWG:</strong> game data provided by <a href="https://rawg.io">RAWG</a>.</li>
<li><strong>Shikimori:</strong> anime data provided by <a href="https://shikimori.io">Shikimori</a>.</li>
<li><strong>Google Books:</strong> book data provided by the Google Books API.</li>
<li><strong>Open Library:</strong> book covers provided by <a href="https://openlibrary.org">Open Library</a>.</li>
</ul>`
}
