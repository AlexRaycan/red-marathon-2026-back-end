import { ILegalPage } from './legal-page.layout'
import {
  LEGAL_APP_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DEVELOPER
} from './legal.constants'

const contact = `<a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a>`

export const PRIVACY_PAGE: ILegalPage = {
  title: 'Privacy Policy',
  body: `
<p>${LEGAL_APP_NAME} is a free app for discovering, rating and organizing movies, TV shows, anime, games and books. It is developed by ${LEGAL_DEVELOPER}. This policy explains what data the app processes and why.</p>

<h2>Data we collect</h2>
<ul>
<li><strong>Account data:</strong> email address, username and a password (stored only as a one-way hash).</li>
<li><strong>Profile and content you create:</strong> profile details, library entries, ratings, reviews, collections and friend connections.</li>
<li><strong>Push notification token:</strong> only if you allow notifications, to deliver them to your device.</li>
<li><strong>AI feature input:</strong> text you submit to AI features and your usage of them.</li>
</ul>

<h2>How we use it</h2>
<p>To provide the app's features: sign-in, your library, recommendations, social features and notifications. We do not sell your data, do not show ads and do not track you across other apps or websites.</p>

<h2>Third-party services</h2>
<ul>
<li>Title information and images are loaded through the TMDB, RAWG, Shikimori, Google Books and Open Library APIs. These requests are made by our server and do not include your personal data.</li>
<li>AI features send the text you submit to an AI provider (OpenRouter and the model providers behind it) to generate a response.</li>
<li>Our server and database are hosted on Render and Neon.</li>
</ul>

<h2>Retention and deletion</h2>
<p>We keep your data while your account exists. You can delete your account and all associated data at any time in the app: Profile → Delete account.</p>

<h2>Children</h2>
<p>${LEGAL_APP_NAME} is not directed to children under 13 and we do not knowingly collect their data.</p>

<h2>Contact</h2>
<p>Questions or data requests: ${contact}.</p>`
}

export const SUPPORT_PAGE: ILegalPage = {
  title: 'Support',
  body: `
<p>Need help with ${LEGAL_APP_NAME}? Write to us and we will reply as soon as we can.</p>
<p>Email: ${contact}</p>

<h2>Common questions</h2>
<h3>How do I delete my account?</h3>
<p>Open Profile → Delete account. Your account and all related data will be removed.</p>
<h3>Posters or titles are not loading</h3>
<p>The server may need up to a minute to wake up after a period of inactivity. Pull to refresh and try again.</p>
<h3>Privacy</h3>
<p>See our <a href="/privacy">Privacy Policy</a>.</p>`
}

export const TERMS_PAGE: ILegalPage = {
  title: 'Terms of Use',
  body: `
<p>By using ${LEGAL_APP_NAME} you agree to these terms.</p>
<ul>
<li>The app is provided free of charge and "as is", without warranties. Availability of external content is not guaranteed.</li>
<li>You are responsible for the content you publish (reviews, collections, profile) and must not post unlawful, abusive or infringing material.</li>
<li>We may remove content or suspend accounts that violate these terms.</li>
<li>Title metadata and images belong to their respective owners and providers (see <a href="/attribution">Attribution</a>).</li>
</ul>
<p>Contact: ${contact}</p>`
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
