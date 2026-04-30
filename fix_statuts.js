// FIX : Mettre les bons statuts dans la page parrainage/fidelite
const fs = require('fs');

let page = fs.readFileSync('/Users/salwa/Documents/respektus-web/parrainage.html', 'utf8');

// Remplacer tout le bloc statuts
page = page.replace(
  /<div class="statut-cards">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<p class="note">/,
  `<div class="statut-cards">
      <div class="statut-card graine">
        <div class="statut-name">Graine</div>
        <div class="statut-points">0 - 299 pts/an</div>
        <div class="statut-benefits">Accès à l'application, conseils personnalisés de Lia et programme de fidélité</div>
      </div>
      <div class="statut-card bourgeon">
        <div class="statut-name">Bourgeon</div>
        <div class="statut-points">300 - 599 pts/an</div>
        <div class="statut-benefits">Livraison offerte dès 30€ d'achat</div>
      </div>
      <div class="statut-card fleur">
        <div class="statut-name">Fleur</div>
        <div class="statut-points">600 - 999 pts/an</div>
        <div class="statut-benefits">Livraison offerte + échantillons gratuits + accès prioritaire aux nouveautés</div>
      </div>
      <div class="statut-card arbre">
        <div class="statut-name">Arbre</div>
        <div class="statut-points">1 000+ pts/an</div>
        <div class="statut-benefits">Tous les avantages Fleur + 10% de réduction permanente + conseils VIP personnalisés</div>
      </div>
    </div>
    <p class="note">`
);

// Remplacer les styles des statuts
page = page.replace(
  /\.bronze \{[^}]*\}\s*\.bronze .statut-name \{[^}]*\}\s*\.silver \{[^}]*\}\s*\.silver .statut-name \{[^}]*\}\s*\.gold \{[^}]*\}\s*\.gold .statut-name \{[^}]*\}\s*\.diamond \{[^}]*\}\s*\.diamond .statut-name \{[^}]*\}/,
  `.graine { background: #EEF7F2; border: 1px solid #C0DEC9; }
    .graine .statut-name { color: #2C5F3F; }
    .bourgeon { background: #FFF8E6; border: 1px solid #E8D9A0; }
    .bourgeon .statut-name { color: #C8A96E; }
    .fleur { background: #FFF0F8; border: 1px solid #E8C0D8; }
    .fleur .statut-name { color: #C05080; }
    .arbre { background: #F0F0FF; border: 1px solid #C0C0E0; }
    .arbre .statut-name { color: #9B8EE0; }`
);

fs.writeFileSync('/Users/salwa/Documents/respektus-web/parrainage.html', page);
console.log('Statuts corriges : Graine, Bourgeon, Fleur, Arbre');
