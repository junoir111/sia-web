// SIA: unit tests of the pure logic. Run with: node --test tests-sia/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_LIFETIME_MS, isExpired, remainingMs } from '../src/app/sia/ephemeral.ts';
import { annonceFromContent, formatRemaining } from '../src/app/sia/wallLogic.ts';
import {
  parseSiaProfile,
  suggestedPseudo,
  formatPrix,
  parseFiche,
  MODALITE_CLIENT_LABELS,
} from '../src/app/sia/profile.ts';

const HOUR = 3600 * 1000;
const NOW = 1_800_000_000_000;

test('a message just seen has its full minute', () => {
  assert.equal(remainingMs(NOW, NOW), MESSAGE_LIFETIME_MS);
  assert.equal(isExpired(NOW, NOW), false);
});

test('a message is expired exactly 1 minute after it was seen', () => {
  assert.equal(isExpired(NOW, NOW + 59_999), false);
  assert.equal(isExpired(NOW, NOW + 60_000), true);
});

test('a message never seen arriving live is expired', () => {
  assert.equal(isExpired(undefined, NOW), true);
  assert.equal(isExpired(0, NOW), true);
});

test('a clock going backwards never gives more than 1 minute', () => {
  assert.equal(remainingMs(NOW, NOW - 600_000), MESSAGE_LIFETIME_MS);
});

const valid = {
  role: 'client',
  pseudo: 'Omega-9',
  categorie: 'Plomberie',
  zone: 'Akanda',
  texte: 'Fuite',
  fin: NOW + HOUR,
};

test('a valid announcement is accepted', () => {
  const annonce = annonceFromContent(valid, NOW, NOW);
  assert.equal(annonce?.texte, 'Fuite');
  assert.equal(annonce?.fin, NOW + HOUR);
});

test('an announcement whose time is over is rejected', () => {
  assert.equal(annonceFromContent(valid, NOW, NOW + HOUR), undefined);
});

test('an announcement cannot live more than 24 hours after it was sent', () => {
  const annonce = annonceFromContent({ ...valid, fin: NOW + 1000 * HOUR }, NOW, NOW);
  assert.equal(annonce?.fin, NOW + 24 * HOUR);
  assert.equal(
    annonceFromContent({ ...valid, fin: NOW + 1000 * HOUR }, NOW, NOW + 25 * HOUR),
    undefined
  );
});

test('invalid announcement content is rejected', () => {
  assert.equal(annonceFromContent(null, NOW, NOW), undefined);
  assert.equal(annonceFromContent({ ...valid, role: 'admin' }, NOW, NOW), undefined);
  assert.equal(annonceFromContent({ ...valid, texte: '   ' }, NOW, NOW), undefined);
  assert.equal(annonceFromContent({ ...valid, fin: 'demain' }, NOW, NOW), undefined);
});

test('over-long announcement fields are cut and a missing pseudo becomes Anonyme', () => {
  const annonce = annonceFromContent({ ...valid, pseudo: 42, texte: 'x'.repeat(999) }, NOW, NOW);
  assert.equal(annonce?.pseudo, 'Anonyme');
  assert.equal(annonce?.texte.length, 280);
});

test('remaining time is shown in minutes then hours', () => {
  assert.equal(formatRemaining(NOW + 45 * 60_000, NOW), '45 min');
  assert.equal(formatRemaining(NOW + 3 * HOUR, NOW), '3 h');
  assert.equal(formatRemaining(NOW + 90 * 60_000, NOW), '1 h 30');
  assert.equal(formatRemaining(NOW - 5, NOW), '0 min');
});

test('a profile needs a known role and a pseudo', () => {
  assert.deepEqual(
    parseSiaProfile({ role: 'prestataire', pseudo: ' Delta-4 ', metier: 'Plombier', zone: 'PK12' }),
    {
      role: 'prestataire',
      pseudo: 'Delta-4',
      metier: 'Plombier',
      zone: 'PK12',
      modalite: 'deux',
      services: [],
    }
  );
  assert.equal(parseSiaProfile({ role: 'espion', pseudo: 'x' }), undefined);
  assert.equal(parseSiaProfile({ role: 'client', pseudo: '' }), undefined);
  assert.equal(parseSiaProfile(undefined), undefined);
});

test('a provider keeps up to 3 valid services with whole prices', () => {
  const profile = parseSiaProfile({
    role: 'prestataire',
    pseudo: 'Delta-4',
    services: [
      { label: ' Débouchage évier ', prix: 5000 },
      { label: 'Fuite', prix: '8000' },
      { label: '', prix: 1000 },
      { label: 'Négatif', prix: -5 },
      { label: 'Trop', prix: 99 },
    ],
  });
  assert.deepEqual(profile?.services, [
    { label: 'Débouchage évier', prix: 5000 },
    { label: 'Fuite', prix: 8000 },
    { label: 'Négatif', prix: 0 },
  ]);
});

test('a price is written with spaces and FCFA, 0 shows a dash', () => {
  assert.equal(formatPrix(5000), '5 000 FCFA');
  assert.equal(formatPrix(1250000), '1 250 000 FCFA');
  assert.equal(formatPrix(0), '—');
});

test('the client reads one clear label for how the provider works', () => {
  assert.equal(MODALITE_CLIENT_LABELS.deplace, 'Il se déplace chez toi');
  assert.equal(MODALITE_CLIENT_LABELS.recoit, 'Tu vas chez lui');
});

test('a fiche is parsed without needing a pseudo', () => {
  assert.deepEqual(parseFiche({ role: 'prestataire', metier: 'Plombier', zone: 'PK12' }), {
    role: 'prestataire',
    metier: 'Plombier',
    zone: 'PK12',
    modalite: 'deux',
    services: [],
    photos: [],
  });
  assert.equal(parseFiche({ metier: 'x' }), undefined);
});

test('a zone from the list is kept, and "Autre" takes the typed zone', async () => {
  const { resolveZone, AUTRE_QUARTIER } = await import('../src/app/sia/quartiers.ts');
  assert.equal(resolveZone('Akébé Plaine', 'ignoré'), 'Akébé Plaine');
  assert.equal(resolveZone(AUTRE_QUARTIER, '  Mon quartier  '), 'Mon quartier');
  assert.equal(resolveZone(AUTRE_QUARTIER, ''), '');
});

test('only a provider can publish an availability status', () => {
  const base = { ...valid, statut: true, modalite: 'deplace' };
  assert.equal(annonceFromContent({ ...base, role: 'prestataire' }, NOW, NOW)?.statut, true);
  assert.equal(annonceFromContent({ ...base, role: 'prestataire' }, NOW, NOW)?.modalite, 'deplace');
  assert.equal(annonceFromContent(base, NOW, NOW)?.statut, false);
  assert.equal(annonceFromContent({ ...valid, modalite: 'volant' }, NOW, NOW)?.modalite, '');
});

test('the sign-up identifier is proposed as pseudo', () => {
  assert.equal(suggestedPseudo('@puma-35:sia.tail94dc60.ts.net'), 'Puma-35');
  assert.equal(suggestedPseudo('@rudy:sia.tail94dc60.ts.net'), 'Rudy');
  assert.equal(suggestedPseudo(null), '');
});

// --- Client requests: budget and offers ---
import { cleanBudget } from '../src/app/sia/wallLogic.ts';
import { parseReason, siblingOffers, withRef } from '../src/app/sia/offres.ts';

test('a client request keeps its budget, a provider announcement never has one', () => {
  assert.equal(annonceFromContent({ ...valid, budget: 25000 }, NOW, NOW)?.budget, 25000);
  assert.equal(
    annonceFromContent({ ...valid, role: 'prestataire', budget: 25000 }, NOW, NOW)?.budget,
    0
  );
  assert.equal(annonceFromContent(valid, NOW, NOW)?.budget, 0);
});

test('a budget is a whole positive amount, anything else becomes 0', () => {
  assert.equal(cleanBudget(5000.9), 5000);
  assert.equal(cleanBudget('25000'), 25000);
  assert.equal(cleanBudget(-3), 0);
  assert.equal(cleanBudget('abc'), 0);
  assert.equal(cleanBudget(Infinity), 0);
  assert.equal(cleanBudget(1e12), 100_000_000);
});

test('an offer reason hides its request reference from the text shown', () => {
  const reason = withRef('Prestataire (Plombier) depuis Akanda accepte ta demande', '$abc:sia');
  assert.deepEqual(parseReason(reason), {
    text: 'Prestataire (Plombier) depuis Akanda accepte ta demande',
    ref: '$abc:sia',
  });
  assert.deepEqual(parseReason('Tu es dispo ?'), { text: 'Tu es dispo ?' });
  assert.deepEqual(parseReason(42), { text: '' });
});

test('choosing one offer refuses only the other offers on the same request', () => {
  const invitations = [
    { roomId: '!a', reason: withRef('A', '$req1') },
    { roomId: '!b', reason: withRef('B', '$req1') },
    { roomId: '!c', reason: withRef('C', '$req2') },
    { roomId: '!d', reason: 'Tu es dispo ?' },
  ];
  assert.deepEqual(siblingOffers(invitations, '!a'), ['!b']);
  assert.deepEqual(siblingOffers(invitations, '!c'), []);
  assert.deepEqual(siblingOffers(invitations, '!d'), []);
});

// --- Le Mur: grid of trades ---
import { metierKey, metierTiles } from '../src/app/sia/murLogic.ts';

test('announcements of the same trade share one tile, whatever the case or spaces', () => {
  const tiles = metierTiles([
    { role: 'prestataire', categorie: 'Plombier' },
    { role: 'prestataire', categorie: ' plombier ' },
    { role: 'client', categorie: 'PLOMBIER' },
    { role: 'prestataire', categorie: 'Coiffure' },
    { role: 'client', categorie: '' },
  ]);
  assert.deepEqual(
    tiles.map((t) => [t.label, t.dispo, t.demandes]),
    [
      ['Plombier', 2, 1],
      ['Autre', 0, 1],
      ['Coiffure', 1, 0],
    ]
  );
  assert.equal(metierKey('  '), 'autre');
});

test('no announcement gives no tile', () => {
  assert.deepEqual(metierTiles([]), []);
});
