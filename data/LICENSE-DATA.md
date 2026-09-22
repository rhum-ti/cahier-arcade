# Licence et méthodologie — data/vocab.json

## Licence

Ce fichier (8000 mots français, niveaux approximatifs, traductions coréennes) est distribué sous
licence **CC BY-SA 4.0** (Creative Commons Attribution — Partage dans les mêmes conditions),
car il est dérivé d'une base de données elle-même sous CC BY-SA 4.0. Toute redistribution de ce
fichier, modifiée ou non, doit conserver la même licence et l'attribution ci-dessous.

Cette licence s'applique uniquement à ce fichier de données. Le code de l'application
(`js/`, `css/`, `index.html`) suit sa propre licence, indépendante de celle-ci.

## Attribution

Liste de mots et fréquences source : **Lexique 3.83**
New, B., Pallier, C., Brysbaert, M., Ferrand, L. — *Lexique*, http://www.lexique.org — CC BY-SA 4.0.

## Méthodologie

- **Sélection des mots** : les 8000 lemmes les plus fréquents du français (catégories noms,
  verbes, adjectifs, adverbes, interjections, nombres) d'après la fréquence en sous-titres de
  films de Lexique 3.83, après exclusion des mots grammaticaux purs, des artefacts de corpus
  (résidus de sous-titrage, noms propres mal étiquetés, etc.) et des insultes/injures.
- **Niveaux (A1 → C1)** : *approximatifs*, dérivés du rang de fréquence, et non d'une
  certification CEFR officielle. Les seuils cumulés utilisés (A1 : 1000 mots, A2 : 1000, B1 :
  1500, B2 : 1500, C1 : 3000) s'inspirent d'ordres de grandeur courants dans la littérature sur
  la taille du vocabulaire par niveau (travaux de type Milton et al.), qui portent principalement
  sur l'anglais langue étrangère — leur application au français est donc elle-même une couche
  d'approximation supplémentaire.
- **Contenu retiré par choix éditorial** : vocabulaire à caractère sexuel explicite et vocabulaire
  décrivant un meurtre, une arme, ou un crime violent grave ont été volontairement exclus pour
  garder l'application adaptée à tous les publics. Le vocabulaire familier/argotique non vulgaire
  a été conservé (voir le thème "Argot" dans l'app).
- **Traductions coréennes** : générées automatiquement (sans API de traduction externe), puis
  vérifiées par rétro-traduction indépendante (KO→FR par un second passage sans accès au français
  d'origine) et relecture ciblée des divergences. Un échantillon aléatoire a également été
  relu manuellement sur chaque tranche de niveau. Malgré ce contrôle, il ne s'agit pas d'une
  traduction certifiée par un professionnel — des erreurs ponctuelles peuvent subsister.
