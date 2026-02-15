# 🌐 WebMCP & MCP-B — Chrome Tarayıcı İçin AI Agent Protokolü

## Kapsamlı Araştırma Raporu
**Tarih:** Şubat 2026  
**Konu:** WebMCP (Web Model Context Protocol) ve MCP-B (Model Context Protocol for Browser)

---

## 📑 İçindekiler

1. [Genel Bakış](#1-genel-bakis)
2. [MCP Nedir? (Temel Protokol)](#2-mcp-nedir)
3. [WebMCP Nedir?](#3-webmcp-nedir)
4. [MCP-B Nedir?](#4-mcp-b-nedir)
5. [WebMCP vs MCP-B — Farklar](#5-webmcp-vs-mcp-b)
6. [WebMCP API Detayları](#6-webmcp-api-detaylari)
7. [MCP-B Mimari ve Transport Katmanları](#7-mcp-b-mimari)
8. [Kod Örnekleri](#8-kod-ornekleri)
9. [Güvenlik ve Gizlilik](#9-guvenlik)
10. [Performans Karşılaştırması](#10-performans)
11. [Kurulum ve Geliştirme](#11-kurulum)
12. [Kullanım Senaryoları](#12-kullanimlar)
13. [Sınırlamalar](#13-sinirlamalar)
14. [Gelecek ve Standardizasyon](#14-gelecek)

---

## 1. Genel Bakış {#1-genel-bakis}

WebMCP ve MCP-B, AI agent'larının web siteleriyle **yapılandırılmış ve güvenilir** şekilde etkileşim kurmasını sağlayan iki ilişkili ancak farklı teknolojidir.

### Kısa Özet

| Özellik | WebMCP | MCP-B |
|---------|--------|-------|
| **Ne?** | W3C web standardı önerisi | Chrome extension + framework |
| **Kim tarafından?** | Google Chrome + W3C Community | MCP-B.ai (açık kaynak) |
| **Nerede çalışır?** | Tarayıcı içinde (client-side) | Tarayıcı extension olarak |
| **API** | `navigator.modelContext` | `@mcp-b/transports` npm paketi |
| **Amaç** | Web sitelerini AI-agent-ready yapmak | MCP sunucularını web sayfalarına gömmek |
| **Durum** | Early preview (Chrome 146+) | Chrome Web Store'da mevcut |

---

## 2. MCP Nedir? (Temel Protokol) {#2-mcp-nedir}

**Model Context Protocol (MCP)**, Anthropic tarafından **Kasım 2024**'te tanıtılan açık kaynak bir standarttır.

### Temel Konsept
- AI uygulamaları (LLM'ler) ile dış sistemler arasında **standart iletişim protokolü**
- **"AI için USB-C portu"** benzetmesi — her şeyi tek bir standartla bağlar
- **JSON-RPC 2.0** tabanlı iletişim

### MCP Bileşenleri
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MCP Host    │────▶│  MCP Client  │────▶│  MCP Server  │
│ (Claude, vb.) │     │  (Bağlayıcı) │     │ (Araç sağlar)│
└──────────────┘     └──────────────┘     └──────────────┘
```

### MCP Sunucusu Ne Sağlar?
- **Tools** — Çağrılabilir fonksiyonlar (API çağrıları, dosya işlemleri vb.)
- **Resources** — Okunabilir veriler (dosya içerikleri, veritabanı kayıtları)
- **Prompts** — Önceden tanımlanmış prompt şablonları

### Geleneksel MCP'nin Sınırlamaları
1. Backend sunucusu gerektirir (ayrı process)
2. OAuth 2.1 veya API key ile kimlik doğrulama
3. Karmaşık kurulum ve yapılandırma
4. Tarayıcı oturumu bilgilerine erişemez

---

## 3. WebMCP Nedir? {#3-webmcp-nedir}

**WebMCP**, Google Chrome tarafından **10 Şubat 2026**'da duyurulan yeni bir tarayıcı API'sidir.

### Temel Felsefe
> Web sitelerinin AI agent'larına **yapılandırılmış araçlar (tools)** sunmasını sağlayan bir web standardı

### Ne Değişiyor?

**Eski Yöntem (Screen Scraping):**
```
AI Agent → Ekran görüntüsü al → Pikselleri analiz et → Butonu bul → Tıkla
❌ Yavaş, kırılgan, güvenilmez
```

**Yeni Yöntem (WebMCP):**
```
AI Agent → navigator.modelContext → Yapılandırılmış araçları keşfet → Doğrudan çağır
✅ Hızlı, güvenilir, yapılandırılmış
```

### Temel Özellikler

1. **Client-Side Çalışır** — Tüm işlem tarayıcı sekmesinde
2. **İki API Yaklaşımı** — Declarative (HTML) ve Imperative (JavaScript)
3. **Human-in-the-Loop** — Kullanıcı onayı gerektirebilir
4. **Model Agnostik** — Gemini, Claude, ChatGPT ile uyumlu
5. **HTTPS Zorunlu** — Güvenli bağlam gerektirir

### Önemli Not
WebMCP şunlar için **DEĞİLDİR:**
- ❌ Headless tarayıcı otomasyonu
- ❌ Tamamen otonom agent'lar
- ❌ Backend servis entegrasyonu
- ❌ Web sitesi UI'sinin yerini almak

---

## 4. MCP-B Nedir? {#4-mcp-b-nedir}

**MCP-B (Model Context Protocol for the Browser)**, MCP'yi tarayıcıya taşıyan bir **extension + framework** çözümüdür.

### Temel Fikir
> Web sayfalarını MCP sunucularına dönüştür — ayrı backend gerekmez

### MCP-B Mimarisi

```
┌─────────────────────────────────────────────────────────┐
│                    CHROME TARAYICI                       │
│                                                         │
│  ┌───────────────────┐     ┌──────────────────────────┐ │
│  │   Web Sayfası      │     │   MCP-B Extension        │ │
│  │                    │     │                          │ │
│  │  ┌──────────────┐ │     │  ┌────────────────────┐  │ │
│  │  │ Tab MCP      │ │◄───▶│  │ Content Scripts    │  │ │
│  │  │ Server       │ │     │  │ (postMessage)      │  │ │
│  │  │              │ │     │  └────────────────────┘  │ │
│  │  │ • Tools      │ │     │  ┌────────────────────┐  │ │
│  │  │ • Resources  │ │     │  │ MCP Hub            │  │ │
│  │  │ • Auth       │ │     │  │ (Service Worker)   │  │ │
│  │  └──────────────┘ │     │  │ • Tool Aggregation │  │ │
│  │                    │     │  │ • Call Routing     │  │ │
│  │  Mevcut API'ler   │     │  └────────────────────┘  │ │
│  │  (cookies, JWT)    │     │  ┌────────────────────┐  │ │
│  └───────────────────┘     │  │ Side Panel Chat    │  │ │
│                             │  │ (Built-in AI)      │  │ │
│                             │  └────────────────────┘  │ │
│                             └──────────────────────────┘ │
│                                        │                 │
│                                        ▼                 │
│                             ┌──────────────────────┐     │
│                             │ Native Bridge        │     │
│                             │ (Native Messaging)   │     │
│                             └──────────────────────┘     │
│                                        │                 │
└────────────────────────────────────────│─────────────────┘
                                         ▼
                              ┌──────────────────────┐
                              │ Harici MCP Client'lar│
                              │ (Claude Desktop,     │
                              │  Cursor, vb.)        │
                              └──────────────────────┘
```

### MCP-B'nin Avantajları

1. **Browser-Native Sunucular** — MCP sunucu web sayfasının kendisinde
2. **Sıfır Yapılandırma** — API key, OAuth yok
3. **Mevcut Auth Kullan** — Tarayıcı cookie/JWT otomatik
4. **10.000x Performans** — Direkt API çağrısı vs screenshot analizi
5. **Cross-Application** — Farklı web uygulamaları arası iş akışı

---

## 5. WebMCP vs MCP-B — Farklar {#5-webmcp-vs-mcp-b}

| Kriter | WebMCP | MCP-B |
|--------|--------|-------|
| **Tip** | Web Standardı (W3C önerisi) | Extension + npm paketi |
| **Geliştirici** | Google Chrome / W3C | MCP-B.ai (açık kaynak) |
| **API** | `navigator.modelContext` (native) | `TabServerTransport` (polyfill) |
| **Sunucu Konumu** | Tarayıcı sekmesinde (built-in) | Web sayfasına gömülü |
| **Dış Bağlantı** | Sadece tarayıcı içi | Claude Desktop vb.'ye köprü |
| **Form Desteği** | Declarative HTML attributes | JavaScript only |
| **Durum** | Early preview (flag ile) | Production-ready extension |
| **Standartlaşma** | W3C Community Group | Bağımsız proje |
| **Polyfill** | Yok (native) | Evet (MCP-B polyfill sağlar) |

### İlişkileri

```
WebMCP (Standart)
   │
   ├── Chrome'un native implementasyonu (navigator.modelContext)
   │
   └── MCP-B (Polyfill + Köprü)
         ├── Native olmayan tarayıcılarda WebMCP desteği
         ├── Harici MCP client'larına bağlantı
         └── Ek transport katmanları
```

**Özet:** WebMCP **standart**, MCP-B **uygulama + köprü**.

---

## 6. WebMCP API Detayları {#6-webmcp-api-detaylari}

### 6.1 Declarative API (HTML Forms)

En basit entegrasyon yöntemi — sadece HTML attribute'ları ekle:

```html
<!-- Basit ürün arama formu -->
<form toolname="searchProducts"
      tooldescription="Ürün kataloğunda arama yapar"
      toolautosubmit="true">
    
    <label for="query">Arama:</label>
    <input type="text" 
           name="query" 
           placeholder="Ne arıyorsunuz?"
           required>
    
    <label for="category">Kategori:</label>
    <select name="category">
        <option value="elektronik">Elektronik</option>
        <option value="giyim">Giyim</option>
        <option value="ev">Ev & Yaşam</option>
    </select>
    
    <label for="maxPrice">Maks Fiyat:</label>
    <input type="number" name="maxPrice" min="0" max="100000">
    
    <button type="submit">Ara</button>
</form>
```

Chrome bu formu otomatik olarak şu tool şemasına çevirir:
```json
{
    "name": "searchProducts",
    "description": "Ürün kataloğunda arama yapar",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": { "type": "string" },
            "category": { "type": "string", "enum": ["elektronik", "giyim", "ev"] },
            "maxPrice": { "type": "number", "minimum": 0, "maximum": 100000 }
        },
        "required": ["query"]
    }
}
```

### Agent Submit Tespiti

```javascript
// Formun AI agent tarafından mı yoksa kullanıcı tarafından mı 
// gönderildiğini tespit et
document.querySelector('form').addEventListener('submit', (event) => {
    if (event.agentInvoked) {
        console.log('Bu form bir AI agent tarafından gönderildi');
        // Agent'a yapılandırılmış yanıt dön
        event.respondWith({
            results: [
                { id: 1, name: "Ürün A", price: 99.99 },
                { id: 2, name: "Ürün B", price: 149.99 }
            ],
            totalCount: 2
        });
    }
});
```

### CSS Pseudo-Sınıfları

```css
/* AI agent form ile etkileşimde olduğunda farklı stil */
form:tool-form-active {
    border: 2px solid #4285f4;
    background: rgba(66, 133, 244, 0.05);
}

/* Agent submit butonuna tıkladığında */
button:tool-submit-active {
    background: #4285f4;
    color: white;
    animation: pulse 1s infinite;
}
```

### 6.2 Imperative API (JavaScript)

Daha karmaşık ve dinamik etkileşimler için:

```javascript
// Tool kaydet
navigator.modelContext.registerTool({
    name: "createSupportTicket",
    description: "Müşteri destek bileti oluşturur",
    inputSchema: {
        type: "object",
        properties: {
            subject: {
                type: "string",
                description: "Bilet konusu"
            },
            priority: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
                description: "Öncelik seviyesi"
            },
            description: {
                type: "string",
                description: "Detaylı açıklama"
            },
            attachments: {
                type: "array",
                items: { type: "string" },
                description: "Ek dosya URL'leri"
            }
        },
        required: ["subject", "priority", "description"]
    },
    async execute(params) {
        // Mevcut API'yi kullan (authentication otomatik)
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        
        const ticket = await response.json();
        
        return {
            ticketId: ticket.id,
            status: ticket.status,
            url: `https://support.example.com/tickets/${ticket.id}`
        };
    }
});

// Tool kaldır
navigator.modelContext.unregisterTool("createSupportTicket");

// Tüm context'i değiştir
navigator.modelContext.provideContext({
    tools: [...],
    resources: [...]
});

// Context'i temizle
navigator.modelContext.clearContext();
```

---

## 7. MCP-B Mimari ve Transport Katmanları {#7-mcp-b-mimari}

### Transport Türleri

MCP-B, farklı iletişim senaryoları için çeşitli transport mekanizmaları sunar:

```
┌─────────────────────────────────────────────────────┐
│                MCP-B Transports                      │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Tab Transport   │  │ Iframe Transport          │  │
│  │ (Sayfa ↔ Ext.)  │  │ (Cross-origin iframe)     │  │
│  │ postMessage     │  │ postMessage + origin      │  │
│  └─────────────────┘  └──────────────────────────┘  │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Extension       │  │ Native Messaging         │  │
│  │ Transport       │  │ Transport                │  │
│  │ (Ext. ↔ Sayfa)  │  │ (Tarayıcı ↔ Desktop)     │  │
│  └─────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1. Tab Transport (En Yaygın)
- Web sayfası → MCP-B Extension arasında
- `postMessage` API kullanır
- In-memory transport (ultra hızlı)

### 2. Iframe Transport
- Cross-origin iframe'ler arası iletişim
- Origin doğrulaması ile güvenli

### 3. Extension Transport
- Tarayıcı extension'ları arası
- Chrome messaging API

### 4. Native Messaging Transport
- Tarayıcı → Masaüstü uygulamaları
- Claude Desktop, Cursor vb. ile bağlantı

### MCP Hub (Service Worker)
Extension'ın kalbi — tüm sekmelerdeki MCP sunucularını yönetir:

```
MCP Hub Görevleri:
├── Tool Aggregation — Tüm sekmelerdeki tool'ları toplar
├── Call Routing — Doğru sekmeye yönlendirir
├── Connection Management — Bağlantıları yönetir
├── Lifecycle Management — Sekme açılma/kapanma
└── Conflict Resolution — Aynı isimli tool'ları yönetir
```

---

## 8. Kod Örnekleri {#8-kod-ornekleri}

### 8.1 MCP-B ile Web Sayfasına MCP Sunucu Ekleme

```javascript
// npm install @mcp-b/transports @modelcontextprotocol/sdk

import { TabServerTransport } from '@mcp-b/transports';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// MCP sunucu oluştur
const server = new McpServer({
    name: 'fatura-sistemi',
    version: '1.0.0'
});

// Tool tanımla — Fatura oluşturma
server.tool(
    'createInvoice',
    'Yeni fatura oluşturur',
    {
        customerEmail: z.string().email(),
        items: z.array(z.object({
            description: z.string(),
            amount: z.number()
        }))
    },
    async ({ customerEmail, items }) => {
        // Mevcut API'yi kullan (auth otomatik — cookie/JWT)
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerEmail, items })
        });

        if (!response.ok) {
            throw new Error(`Fatura oluşturulamadı: ${response.statusText}`);
        }

        const invoice = await response.json();
        
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(invoice)
            }]
        };
    }
);

// Tool tanımla — Fatura arama
server.tool(
    'searchInvoices',
    'Fatura arar ve filtreler',
    {
        query: z.string().optional(),
        status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional(),
        dateRange: z.object({
            start: z.string(),
            end: z.string()
        }).optional()
    },
    async (params) => {
        const queryParams = new URLSearchParams(params);
        const response = await fetch(`/api/invoices?${queryParams}`);
        const invoices = await response.json();
        
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(invoices)
            }]
        };
    }
);

// Transport başlat — Extension ile iletişim kur
const transport = new TabServerTransport();
await server.connect(transport);

console.log('MCP sunucu aktif — AI agent\'lar artık bu sayfayla etkileşime geçebilir');
```

### 8.2 React ile WebMCP Entegrasyonu

```jsx
// npm install @mcp-b/react-webmcp

import { useWebMCP, useTool } from '@mcp-b/react-webmcp';

function ProductDashboard() {
    // Dashboard'u AI-kontrol edilebilir yap
    const { isAgentConnected } = useWebMCP({
        serverName: 'product-dashboard',
        version: '1.0.0'
    });

    // Ürün filtreleme tool'u
    useTool({
        name: 'filterProducts',
        description: 'Ürünleri kategoriye, fiyata veya stok durumuna göre filtreler',
        schema: {
            category: { type: 'string', enum: ['electronics', 'clothing', 'home'] },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            inStock: { type: 'boolean' }
        },
        execute: async (params) => {
            // State güncelle, API çağır, vb.
            const filtered = await filterProducts(params);
            return { results: filtered, count: filtered.length };
        }
    });

    return (
        <div>
            {isAgentConnected && (
                <div className="agent-badge">🤖 AI Agent bağlı</div>
            )}
            {/* Normal dashboard UI */}
        </div>
    );
}
```

### 8.3 WebMCP Declarative API — Tam Örnek

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Otel Arama — WebMCP Demo</title>
    <style>
        form:tool-form-active {
            border: 2px solid #4285f4;
            box-shadow: 0 0 20px rgba(66, 133, 244, 0.3);
        }
        .agent-indicator {
            display: none;
            color: #4285f4;
            font-weight: bold;
        }
        form:tool-form-active .agent-indicator {
            display: block;
        }
    </style>
</head>
<body>
    <h1>Otel Arama</h1>
    
    <div class="agent-indicator">🤖 AI Agent bu formu dolduruyor...</div>
    
    <form toolname="searchHotels"
          tooldescription="Belirtilen kriterlere göre otel arar. Şehir, tarih ve misafir sayısına göre uygun otelleri listeler."
          toolautosubmit="true"
          method="POST"
          action="/api/hotels/search">
        
        <label>Şehir:
            <input type="text" name="city" required
                   placeholder="İstanbul, Ankara, İzmir...">
        </label>
        
        <label>Giriş Tarihi:
            <input type="date" name="checkIn" required>
        </label>
        
        <label>Çıkış Tarihi:
            <input type="date" name="checkOut" required>
        </label>
        
        <label>Misafir Sayısı:
            <input type="number" name="guests" min="1" max="10" value="2">
        </label>
        
        <label>Yıldız:
            <select name="stars">
                <option value="">Hepsi</option>
                <option value="3">3 Yıldız</option>
                <option value="4">4 Yıldız</option>
                <option value="5">5 Yıldız</option>
            </select>
        </label>
        
        <button type="submit">Otel Ara</button>
    </form>

    <script>
        document.querySelector('form').addEventListener('submit', (e) => {
            if (e.agentInvoked) {
                e.preventDefault();
                // AI agent'a yapılandırılmış veri dön
                e.respondWith(
                    fetch('/api/hotels/search', {
                        method: 'POST',
                        body: new FormData(e.target)
                    })
                    .then(r => r.json())
                    .then(data => ({
                        hotels: data.results,
                        totalCount: data.total,
                        cheapest: data.results[0]
                    }))
                );
            }
        });
    </script>
</body>
</html>
```

---

## 9. Güvenlik ve Gizlilik {#9-guvenlik}

### WebMCP Güvenlik Modeli

```
┌──────────────────────────────────────────┐
│           Güvenlik Katmanları             │
│                                          │
│  1. HTTPS Zorunlu (Secure Context)       │
│  2. Same-Origin Policy                   │
│  3. Permission-First Protocol            │
│  4. User Confirmation Prompts            │
│  5. Agent-Invoked Event Tracking         │
│  6. Browser Sandbox                      │
└──────────────────────────────────────────┘
```

### Önemli Güvenlik Noktaları

1. **Permission-First** — Hassas işlemler için tarayıcı kullanıcıdan onay ister
   ```
   "booking-site.com AI agent'ın bu uçuşu rezerve etmesine izin vermek istiyor musunuz?"
   [İzin Ver] [Reddet]
   ```

2. **Agent Tespiti** — Web sitesi agent etkileşimini ayırt edebilir
   ```javascript
   event.agentInvoked // true = AI agent, false = kullanıcı
   ```

3. **Lokal Çalışma** — Tüm otomasyon kullanıcının cihazında
   - Tarayıcı aktivitesi gizli kalır
   - Mevcut profil ve oturum kullanılır
   - Bot algılama riski düşük

4. **Tool Kapsamı** — Web sitesi sadece izin verdiği tool'ları açar
   - Hassas API'ler gizli tutulabilir
   - Rate limiting uygulanabilir

### MCP-B Güvenlik

- Mevcut cookie/JWT auth kullanır — ekstra credential gerekmez
- Her sekme izole MCP sunucu — cross-tab erişim yok
- Extension permission modeli — kullanıcı onayı gerekli
- Kod tarayıcı sandbox'ında çalışır

---

## 10. Performans Karşılaştırması {#10-performans}

### Geleneksel AI Browser Otomasyonu vs WebMCP

| Metrik | Geleneksel (Screenshot) | WebMCP / MCP-B |
|--------|------------------------|----------------|
| **İşlem Süresi** | 10-20 saniye | Milisaniyeler |
| **API Maliyeti** | $4-5 / basit işlem | ~$0 (lokal) |
| **Model Çağrısı** | Çoklu (UI parsing) | Tek (direkt çağrı) |
| **Token Kullanımı** | Yüksek (görüntü analizi) | %67 azalma |
| **Doğruluk** | ~70-80% | ~98% |
| **Güvenilirlik** | UI değişikliğinde kırılır | API tabanlı, sağlam |
| **Auth Yönetimi** | Karmaşık (headless login) | Otomatik (mevcut oturum) |

### Performans İyileştirmesi Detayı

```
Senaryo: E-ticaret ürün arama

ESKI YÖNTEM (Playwright/Selenium + Screenshot):
1. Sayfayı yükle                    → 2s
2. Screenshot al                     → 0.5s
3. Screenshot'ı LLM'e gönder        → 3s (network + inference)
4. LLM sonucunu parse et            → 0.5s
5. Arama kutusunu bul               → 1s
6. Metin yaz                        → 1s
7. Submit butonunu bul              → 1s
8. Tıkla                           → 0.5s
9. Sonuçları bekle + screenshot     → 3s
10. Sonuçları parse et              → 3s
─────────────────────────────────────
TOPLAM: ~16 saniye + ~$4 API maliyeti

WEBMCP YÖNTEMI:
1. navigator.modelContext.tools → "searchProducts" keşfet  → 1ms
2. searchProducts.execute({query: "laptop"})                → 200ms
3. Yapılandırılmış JSON sonuç al                            → 1ms
─────────────────────────────────────
TOPLAM: ~202ms + ~$0 API maliyeti
```

---

## 11. Kurulum ve Geliştirme {#11-kurulum}

### 11.1 WebMCP (Chrome Native) Etkinleştirme

```
1. Chrome 146+ (Canary) kur
2. chrome://flags adresine git
3. "WebMCP for testing" ara
4. "Enabled" olarak değiştir
5. Chrome'u yeniden başlat
```

### 11.2 Model Context Tool Inspector (Debug)

Google'ın resmi debug aracı:
- Kayıtlı tool'ları görüntüle
- Tool'ları manuel çalıştır
- Schema doğrulaması
- Real-time agent invocation izleme

### 11.3 MCP-B Extension Kurulum

**Chrome Web Store'dan:**
```
https://chromewebstore.google.com/detail/mcp-bextension/daohopfhkdelnpemnhlekblhnikhdhfa
```

**Geliştirici Olarak:**
```bash
# Paketleri kur
npm install @mcp-b/transports @modelcontextprotocol/sdk

# Opsiyonel — Zod validation
npm install zod

# React entegrasyonu için
npm install @mcp-b/react-webmcp
```

### 11.4 Live Demo

Google'ın resmi travel booking demosu:
```
https://travel-demo.bandarra.me/
```
- Declarative ve Imperative API örnekleri
- Uçuş arama + otel filtreleme
- Agent etkileşimi canlı test

---

## 12. Kullanım Senaryoları {#12-kullanimlar}

### 12.1 E-Ticaret
```javascript
// AI Agent: "Bana 500TL altı, 4+ yıldızlı kablosuz kulaklık bul"
navigator.modelContext.registerTool({
    name: "filterProducts",
    description: "Ürünleri fiyat, puan ve kategoriye göre filtreler",
    // ... schema ...
    execute: async ({ maxPrice, minRating, category }) => {
        return await api.products.search({ maxPrice, minRating, category });
    }
});
```

### 12.2 Müşteri Destek
```javascript
// AI Agent: "Kargo takip numarası TR123456 için destek bileti aç"
navigator.modelContext.registerTool({
    name: "createTicket",
    description: "Müşteri destek bileti oluşturur",
    // ... detayları otomatik doldur ...
});
```

### 12.3 Seyahat Rezervasyonu
```javascript
// AI Agent: "15-20 Mart arası İstanbul-Amsterdam uçuşu ara"
// Declarative API ile form'u otomatik doldur
```

### 12.4 Finans / Bankacılık
```javascript
// AI Agent: "Son 3 ayın harcama özetini çıkar"
navigator.modelContext.registerTool({
    name: "getSpendingSummary",
    description: "Belirli tarih aralığındaki harcama özetini getirir",
    // ... auth otomatik, kullanıcının mevcut oturumunu kullanır ...
});
```

### 12.5 İç Kurumsal Araçlar
```javascript
// AI Agent: "CRM'den Ahmet'in son 5 siparişini getir"
// MCP-B sunucu CRM web uygulamasına gömülü
```

---

## 13. Sınırlamalar {#13-sinirlamalar}

### WebMCP Sınırlamaları
1. **Early Preview** — Sadece Chrome 146 Canary'de flag ile
2. **Adoption** — Web sitelerinin entegre etmesi gerekli
3. **HTTPS Zorunlu** — Localhost hariç HTTP'de çalışmaz
4. **Headless Yok** — Görünür tarayıcı penceresi gerekli
5. **Standardizasyon** — W3C süreci uzun, henüz draft

### MCP-B Sınırlamaları
1. **Extension Bağımlılığı** — Kullanıcının yüklemesi gerekli
2. **Closed Source** — Eski sürümler açık kaynak, yeniler değil
3. **Tarayıcı Desteği** — Ağırlıklı Chrome/Edge/Firefox
4. **Web Sitesi Desteği** — Site'nin MCP sunucu tanımlaması gerekli
5. **Karmaşıklık** — Basit otomasyon için overengineering olabilir

### Genel Sınırlamalar
- AI agent'ın tool'ları **doğru anlaması** gerekli
- Rate limiting ve abuse koruması web sitesinin sorumluluğu
- Cross-origin kısıtlamaları hâlâ geçerli
- Kullanıcı müdahalesi gereken durumlar (CAPTCHA vb.)

---

## 14. Gelecek ve Standardizasyon {#14-gelecek}

### Yol Haritası

```
2024 Q4 — MCP protokolü Anthropic tarafından tanıtıldı
2025    — MCP ekosistemi büyüdü (1000+ sunucu)
2026 Q1 — WebMCP Chrome'da early preview (Şubat 2026)
2026 Q1 — MCP-B extension Chrome Web Store'da
2026    — W3C Web Machine Learning CG'de incubation
2027?   — WebMCP stable Chrome release
2027+   — Diğer tarayıcılarda (Firefox, Safari) destek
```

### Beklenen Gelişmeler

1. **Multi-Agent İş Akışları** — Birden fazla AI agent koordinasyonu
2. **Resource API** — Tool'ların yanı sıra okunabilir veri kaynakları
3. **Prompt Şablonları** — Web sitelerinin önerilen prompt'lar sunması
4. **Offline Destek** — Service Worker entegrasyonu
5. **WebAssembly Transport** — Daha hızlı veri transferi
6. **Cross-Browser Standard** — Safari ve Firefox desteği

### Etki Alanları

```
Web Geliştirme     → Her site "agent-ready" olacak
SEO                → "Agent Engine Optimization" kavramı
E-Ticaret          → AI-assisted alışveriş deneyimi
Kurumsal           → İç araçlarda AI otomasyon
Erişilebilirlik    → Yardımcı teknolojiler için yeni API
Güvenlik           → Yeni saldırı vektörleri ve savunmalar
```

---

## 📚 Kaynaklar ve Linkler

| Kaynak | URL |
|--------|-----|
| WebMCP Spec (W3C) | `https://AdrianBDesigns.github.io/webmcp/` |
| WebMCP GitHub | `https://github.com/AdrianBDesigns/webmcp` |
| MCP-B Resmi Site | `https://mcp-b.ai` |
| MCP-B GitHub | `https://github.com/nicholasoxford/mcp-b` |
| Chrome Blog | `https://developer.chrome.com/blog/webmcp` |
| MCP-B Extension | Chrome Web Store: `daohopfhkdelnpemnhlekblhnikhdhfa` |
| npm @mcp-b/transports | `https://www.npmjs.com/package/@mcp-b/transports` |
| npm @mcp-b/react-webmcp | `https://www.npmjs.com/package/@mcp-b/react-webmcp` |
| Travel Demo | `https://travel-demo.bandarra.me/` |
| MCP Resmi Spec | `https://modelcontextprotocol.io` |

---

*Bu araştırma Şubat 2026 itibariyle günceldir. WebMCP henüz early preview aşamasındadır ve API'ler değişebilir.*
