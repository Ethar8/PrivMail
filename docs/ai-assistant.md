# AI-Assistent

PrivMail bietet einen optionalen AI-Assistenten für E-Mail-Zusammenfassungen und Antwortvorschläge.

## Konfiguration

Die AI-Konfiguration erfolgt pro Benutzer unter **Einstellungen > AI**.

### Unterstützte Provider

| Provider | Beschreibung |
|----------|-------------|
| **Ollama** | Lokaler, selbstgehosteter AI-Server (kostenlos, 100 % privat) |
| **OpenAI** | OpenAI API (ChatGPT-Modelle) |
| **Custom** | OpenAI-kompatibler Endpunkt (z. B. LM Studio, vLLM, Groq, Mistral) |

### Ollama konfigurieren

1. Ollama lokal oder auf einem Server installieren: [ollama.com](https://ollama.com)
2. Endpunkt angeben (Standard: `http://localhost:11434`)
3. Modell auswählen (z. B. `llama3`, `mistral`, `gemma`)
4. In PrivMail unter **Einstellungen > AI > Ollama** die URL und das Modell eintragen

### OpenAI konfigurieren

1. API-Key auf [platform.openai.com](https://platform.openai.com) erstellen
2. In PrivMail unter **Einstellungen > AI > OpenAI** den Key und das Modell (`gpt-4o`, `gpt-4o-mini`, etc.) eintragen

### Custom Endpoint konfigurieren

1. URL des OpenAI-kompatiblen Endpunkts eintragen (z. B. `http://localhost:1234/v1`)
2. Optional API-Key angeben
3. Modellnamen eintragen

## Datenschutz

AI-Anfragen werden **direkt vom Browser an den Provider** gesendet:

- Der PrivMail-Server ist zu keinem Zeitpunkt involviert
- Keine E-Mail-Inhalte passieren den PrivMail-Server für AI-Zwecke
- Die Kommunikation erfolgt direkt zwischen Browser und AI-Provider

## Funktionen

### Zusammenfassen

Eine ausgewählte E-Mail oder ein Thread kann zusammengefasst werden:

1. E-Mail öffnen
2. Auf **Zusammenfassen** klicken
3. Die Zusammenfassung erscheint oberhalb der E-Mail

### Antwort vorschlagen

Die AI kann Antwortvorschläge für eine E-Mail generieren:

1. E-Mail öffnen
2. Auf **Antwort vorschlagen** klicken
3. Der Vorschlag erscheint im Antwort-Editor und kann bearbeitet werden

### Kontext

Der AI werden folgende Informationen übermittelt:
- E-Mail-Text (Absender, Betreff, Nachrichtentext)
- Anweisung für die gewünschte Aktion (Summarize / Suggest Reply)

Keine weiteren Nutzerdaten oder E-Mails anderer Threads werden übertragen.
