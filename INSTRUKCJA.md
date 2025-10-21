# Instrukcja Użycia - Generator Kart QR

## Jak korzystać z aplikacji?

### Krok 1: Eksportuj dane z Airtable
- Wejdź na stronę: https://airtable.com/appxdDTrFhre7U64L/tblRVfJUWXvulicRm/viwrljmD0xgVcFkUE?blocks=hide
- Wyeksportuj dane jako plik CSV

### Krok 2: Wybierz typ produktu
- **Płyty** - dla produktów płytowych
- **Blaty** - dla blatów roboczych

### Krok 3: Wczytaj plik CSV
- Kliknij w obszar przesyłania lub przeciągnij i upuść plik CSV
- Aplikacja automatycznie przetworzy dane

### Krok 4: Sprawdź dane
- Przejrzyj tabelę podglądową
- Odznacz wiersze, które chcesz wykluczyć z dokumentu
- Sprawdź statystyki: prawidłowe, nieprawidłowe i wykluczone wiersze

### Krok 5: Wygeneruj dokument
- Kliknij przycisk **"Generuj .docx"**
- Poczekaj na zakończenie generowania
- Dokument automatycznie się pobierze jako `qrcards.docx`

## Co zawiera wygenerowany dokument?

- Karty z kodami QR ułożone w 3 kolumnach na stronie A4
- Każda karta zawiera:
  - Kod QR po lewej stronie
  - Nazwę produktu po prawej stronie
  - Tekst: "zaskanuj aby zobaczyć szczegóły i cenę"

## Uwagi

- Jeśli chcesz wczytać inny plik, kliknij przycisk **"Wczytaj Inny Plik"**
- Aplikacja waliduje dane i oznacza błędy (puste nazwy, nieprawidłowe linki)
- Duplikaty URL są oznaczane ostrzeżeniem
