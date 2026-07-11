# Spam-Filter

Der PrivMail Spam-Filter kombiniert mehrere Schutzebenen zur Erkennung und Abwehr unerwünschter E-Mails.

## Schutzebenen

### 1. SPF / DKIM / DMARC-Prüfung

Vor der Inhaltsanalyse werden eingehende E-Mails auf E-Mail-Authentifizierung geprüft:

- **SPF** – Prüft, ob der sendende Server für die Absenderdomain berechtigt ist
- **DKIM** – Validiert die kryptografische Signatur der E-Mail
- **DMARC** – Wertet die Domain-Policy des Absenders aus

Fehlgeschlagene Prüfungen erhöhen den Spam-Score. Implementation unter `backend/src/dns/`.

### 2. Naive-Bayes-Klassifikator

Der Bayes-Klassifikator ist ein statistisches Verfahren zur Textklassifikation:

1. **Training**: Das Modell wird mit als Spam/Ham (kein Spam) markierten E-Mails trainiert. Es lernt die Wahrscheinlichkeiten bestimmter Wörter und Muster für Spam- und Ham-Nachrichten.

2. **Klassifizierung**: Neue E-Mails werden tokenisiert und anhand der gelernten Wahrscheinlichkeiten bewertet. Der resultierende Score fließt in die Gesamtbewertung ein.

Das Modell kann manuell durch Verschieben von E-Mails in/aus dem Spam-Ordner trainiert werden.

### 3. Blacklist / Whitelist

- **Blacklist**: Absenderadressen oder Domains, deren E-Mails immer als Spam markiert werden
- **Whitelist**: Absenderadressen oder Domains, die den Spam-Filter immer passieren

Blacklists und Whitelists werden pro Benutzer in den Einstellungen verwaltet.

### 4. Tracking-Pixel-Erkennung

Tracking-Pixel sind unsichtbare Bilder (meist 1x1 Pixel) in HTML-E-Mails, die beim Laden den Empfang bestätigen und Daten über den Empfänger preisgeben.

PrivMail erkennt und entfernt:

- `<img>`-Tags mit externen Quellen und typischen Tracking-Merkmalen
- Bilder mit `width="1"` / `height="1"` oder ähnlich kleinen Dimensionen
- Externe Ressourcen mit Tracking-Parametern in der URL

Erkannte Tracking-Pixel erhöhen den Spam-Score.

### 5. Phishing-URL-Heuristik

Verdächtige Links in E-Mails werden heuristisch geprüft:

- Diskrepanz zwischen Link-Text und tatsächlicher URL
- IP-Adressen statt Domainnamen in Links
- Bekannte Phishing-Domains
- Übermäßig lange oder verschleierte URLs
- Unicode-Homoglyphen-Angriffe (IDN)

## Scoring

Jede Schutzebene vergibt Punkte zum Spam-Score:

| Prüfung | Max. Score |
|---------|-----------|
| SPF-Fehler | +3 |
| DKIM-Fehler | +3 |
| DMARC-Fail | +4 |
| Bayes-Klassifikator | +5 |
| Blacklist-Treffer | +10 |
| Tracking-Pixel | +2 |
| Phishing-Verdacht | +4 |

**Schwellwert**: 10 Punkte → E-Mail wird in den Spam-Ordner verschoben.

## Implementierung

| Komponente | Pfad |
|-----------|------|
| Spam-Filter | `backend/src/spam/` |
| Bayes-Klassifikator | `backend/src/spam/bayes.ts` |
| Tracking-Pixel | `backend/src/spam/tracking.ts` |
| DNS-Prüfungen | `backend/src/dns/` |
| Blacklist/Whitelist | `backend/src/spam/lists.ts` |
