// ══════════════════════════════════════════════════════════════════
// Phone utilities — shared between PhoneInput (client) and API routes (server)
// ══════════════════════════════════════════════════════════════════

export interface Country {
    code: string     // ISO 3166-1 alpha-2
    name: string
    dialCode: string // without "+"
    flag: string     // emoji flag, derived from `code`
    maxDigits: number
}

/** [ISO alpha-2, display name, dial code without "+", max local digits] */
type CountryRow = [code: string, name: string, dialCode: string, maxDigits: number]

/**
 * Regional indicator pair for an ISO alpha-2 code: "PE" → 🇵🇪.
 * Derived rather than typed out, so 242 flags cannot drift from their codes.
 */
function flagOf(code: string): string {
    return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

const build = (rows: CountryRow[]): Country[] =>
    rows.map(([code, name, dialCode, maxDigits]) => ({ code, name, dialCode, flag: flagOf(code), maxDigits }))

/**
 * Shown first in the picker, in this order: where Wild Grove's guests come from.
 * Also decides which country wins a shared dial code (+1 → R. Dominicana before
 * the rest of the NANP, since `parseE164` takes the first match).
 */
export const PRIORITY_COUNTRIES: Country[] = build([
    ["PE", "Perú"                            , "51" ,  9],
    ["AR", "Argentina"                       , "54" , 10],
    ["BO", "Bolivia"                         , "591",  8],
    ["BR", "Brasil"                          , "55" , 11],
    ["CL", "Chile"                           , "56" ,  9],
    ["CO", "Colombia"                        , "57" , 10],
    ["CR", "Costa Rica"                      , "506",  8],
    ["CU", "Cuba"                            , "53" ,  8],
    ["EC", "Ecuador"                         , "593",  9],
    ["SV", "El Salvador"                     , "503",  8],
    ["GT", "Guatemala"                       , "502",  8],
    ["HN", "Honduras"                        , "504",  8],
    ["MX", "México"                          , "52" , 10],
    ["NI", "Nicaragua"                       , "505",  8],
    ["PA", "Panamá"                          , "507",  8],
    ["PY", "Paraguay"                        , "595",  9],
    ["DO", "R. Dominicana"                   , "1"  , 10],
    ["UY", "Uruguay"                         , "598",  9],
    ["VE", "Venezuela"                       , "58" , 10],
    ["US", "United States"                   , "1"  , 10],
    ["GB", "United Kingdom"                  , "44" , 10],
    ["CA", "Canada"                          , "1"  , 10],
    ["AU", "Australia"                       , "61" ,  9],
    ["IE", "Ireland"                         , "353",  9],
    ["NZ", "New Zealand"                     , "64" ,  9],
])

/** Every other country and territory with an E.164 dial code, alphabetical. */
export const OTHER_COUNTRIES: Country[] = build([
    ["AF", "Afghanistan"                     , "93" ,  9],
    ["AX", "Åland Islands"                   , "358", 10],
    ["AL", "Albania"                         , "355",  9],
    ["DZ", "Algeria"                         , "213",  9],
    ["AS", "American Samoa"                  , "1"  , 10],
    ["AD", "Andorra"                         , "376",  6],
    ["AO", "Angola"                          , "244",  9],
    ["AI", "Anguilla"                        , "1"  , 10],
    ["AG", "Antigua and Barbuda"             , "1"  , 10],
    ["AM", "Armenia"                         , "374",  8],
    ["AW", "Aruba"                           , "297",  7],
    ["AT", "Austria"                         , "43" , 11],
    ["AZ", "Azerbaijan"                      , "994",  9],
    ["BS", "Bahamas"                         , "1"  , 10],
    ["BH", "Bahrain"                         , "973",  8],
    ["BD", "Bangladesh"                      , "880", 10],
    ["BB", "Barbados"                        , "1"  , 10],
    ["BY", "Belarus"                         , "375",  9],
    ["BE", "Belgium"                         , "32" ,  9],
    ["BZ", "Belize"                          , "501",  7],
    ["BJ", "Benin"                           , "229",  8],
    ["BM", "Bermuda"                         , "1"  , 10],
    ["BT", "Bhutan"                          , "975",  8],
    ["BA", "Bosnia and Herzegovina"          , "387",  8],
    ["BW", "Botswana"                        , "267",  8],
    ["IO", "British Indian Ocean Territory"  , "246",  7],
    ["VG", "British Virgin Islands"          , "1"  , 10],
    ["BN", "Brunei"                          , "673",  7],
    ["BG", "Bulgaria"                        , "359",  9],
    ["BF", "Burkina Faso"                    , "226",  8],
    ["BI", "Burundi"                         , "257",  8],
    ["KH", "Cambodia"                        , "855",  9],
    ["CM", "Cameroon"                        , "237",  9],
    ["CV", "Cape Verde"                      , "238",  7],
    ["BQ", "Caribbean Netherlands"           , "599",  7],
    ["KY", "Cayman Islands"                  , "1"  , 10],
    ["CF", "Central African Republic"        , "236",  8],
    ["TD", "Chad"                            , "235",  8],
    ["CN", "China"                           , "86" , 11],
    ["CX", "Christmas Island"                , "61" ,  9],
    ["CC", "Cocos (Keeling) Islands"         , "61" ,  9],
    ["KM", "Comoros"                         , "269",  7],
    ["CK", "Cook Islands"                    , "682",  5],
    ["CI", "Côte d'Ivoire"                   , "225", 10],
    ["HR", "Croatia"                         , "385",  9],
    ["CW", "Curaçao"                         , "599",  8],
    ["CY", "Cyprus"                          , "357",  8],
    ["CZ", "Czechia"                         , "420",  9],
    ["DK", "Denmark"                         , "45" ,  8],
    ["DJ", "Djibouti"                        , "253",  8],
    ["DM", "Dominica"                        , "1"  , 10],
    ["CD", "DR Congo"                        , "243",  9],
    ["EG", "Egypt"                           , "20" , 10],
    ["GQ", "Equatorial Guinea"               , "240",  9],
    ["ER", "Eritrea"                         , "291",  7],
    ["EE", "Estonia"                         , "372",  8],
    ["SZ", "Eswatini"                        , "268",  8],
    ["ET", "Ethiopia"                        , "251",  9],
    ["FK", "Falkland Islands"                , "500",  5],
    ["FO", "Faroe Islands"                   , "298",  6],
    ["FJ", "Fiji"                            , "679",  7],
    ["FI", "Finland"                         , "358", 10],
    ["FR", "France"                          , "33" ,  9],
    ["GF", "French Guiana"                   , "594",  9],
    ["PF", "French Polynesia"                , "689",  8],
    ["GA", "Gabon"                           , "241",  8],
    ["GM", "Gambia"                          , "220",  7],
    ["GE", "Georgia"                         , "995",  9],
    ["DE", "Germany"                         , "49" , 11],
    ["GH", "Ghana"                           , "233",  9],
    ["GI", "Gibraltar"                       , "350",  8],
    ["GR", "Greece"                          , "30" , 10],
    ["GL", "Greenland"                       , "299",  6],
    ["GD", "Grenada"                         , "1"  , 10],
    ["GP", "Guadeloupe"                      , "590",  9],
    ["GU", "Guam"                            , "1"  , 10],
    ["GG", "Guernsey"                        , "44" , 10],
    ["GN", "Guinea"                          , "224",  9],
    ["GW", "Guinea-Bissau"                   , "245",  7],
    ["GY", "Guyana"                          , "592",  7],
    ["HT", "Haiti"                           , "509",  8],
    ["HK", "Hong Kong"                       , "852",  8],
    ["HU", "Hungary"                         , "36" ,  9],
    ["IS", "Iceland"                         , "354",  7],
    ["IN", "India"                           , "91" , 10],
    ["ID", "Indonesia"                       , "62" , 12],
    ["IR", "Iran"                            , "98" , 10],
    ["IQ", "Iraq"                            , "964", 10],
    ["IM", "Isle of Man"                     , "44" , 10],
    ["IL", "Israel"                          , "972",  9],
    ["IT", "Italy"                           , "39" , 10],
    ["JM", "Jamaica"                         , "1"  , 10],
    ["JP", "Japan"                           , "81" , 10],
    ["JE", "Jersey"                          , "44" , 10],
    ["JO", "Jordan"                          , "962",  9],
    ["KZ", "Kazakhstan"                      , "7"  , 10],
    ["KE", "Kenya"                           , "254",  9],
    ["KI", "Kiribati"                        , "686",  8],
    ["XK", "Kosovo"                          , "383",  8],
    ["KW", "Kuwait"                          , "965",  8],
    ["KG", "Kyrgyzstan"                      , "996",  9],
    ["LA", "Laos"                            , "856", 10],
    ["LV", "Latvia"                          , "371",  8],
    ["LB", "Lebanon"                         , "961",  8],
    ["LS", "Lesotho"                         , "266",  8],
    ["LR", "Liberia"                         , "231",  9],
    ["LY", "Libya"                           , "218",  9],
    ["LI", "Liechtenstein"                   , "423",  7],
    ["LT", "Lithuania"                       , "370",  8],
    ["LU", "Luxembourg"                      , "352",  9],
    ["MO", "Macao"                           , "853",  8],
    ["MG", "Madagascar"                      , "261",  9],
    ["MW", "Malawi"                          , "265",  9],
    ["MY", "Malaysia"                        , "60" , 10],
    ["MV", "Maldives"                        , "960",  7],
    ["ML", "Mali"                            , "223",  8],
    ["MT", "Malta"                           , "356",  8],
    ["MH", "Marshall Islands"                , "692",  7],
    ["MQ", "Martinique"                      , "596",  9],
    ["MR", "Mauritania"                      , "222",  8],
    ["MU", "Mauritius"                       , "230",  8],
    ["YT", "Mayotte"                         , "262",  9],
    ["FM", "Micronesia"                      , "691",  7],
    ["MD", "Moldova"                         , "373",  8],
    ["MC", "Monaco"                          , "377",  9],
    ["MN", "Mongolia"                        , "976",  8],
    ["ME", "Montenegro"                      , "382",  8],
    ["MS", "Montserrat"                      , "1"  , 10],
    ["MA", "Morocco"                         , "212",  9],
    ["MZ", "Mozambique"                      , "258",  9],
    ["MM", "Myanmar"                         , "95" ,  9],
    ["NA", "Namibia"                         , "264",  9],
    ["NR", "Nauru"                           , "674",  7],
    ["NP", "Nepal"                           , "977", 10],
    ["NL", "Netherlands"                     , "31" ,  9],
    ["NC", "New Caledonia"                   , "687",  6],
    ["NE", "Niger"                           , "227",  8],
    ["NG", "Nigeria"                         , "234", 10],
    ["NU", "Niue"                            , "683",  4],
    ["NF", "Norfolk Island"                  , "672",  6],
    ["MK", "North Macedonia"                 , "389",  8],
    ["MP", "Northern Mariana Islands"        , "1"  , 10],
    ["NO", "Norway"                          , "47" ,  8],
    ["OM", "Oman"                            , "968",  8],
    ["PK", "Pakistan"                        , "92" , 10],
    ["PW", "Palau"                           , "680",  7],
    ["PS", "Palestine"                       , "970",  9],
    ["PG", "Papua New Guinea"                , "675",  8],
    ["PH", "Philippines"                     , "63" , 10],
    ["PL", "Poland"                          , "48" ,  9],
    ["PT", "Portugal"                        , "351",  9],
    ["PR", "Puerto Rico"                     , "1"  , 10],
    ["QA", "Qatar"                           , "974",  8],
    ["CG", "Republic of the Congo"           , "242",  9],
    ["RE", "Réunion"                         , "262",  9],
    ["RO", "Romania"                         , "40" ,  9],
    ["RU", "Russia"                          , "7"  , 10],
    ["RW", "Rwanda"                          , "250",  9],
    ["BL", "Saint Barthélemy"                , "590",  9],
    ["SH", "Saint Helena"                    , "290",  4],
    ["KN", "Saint Kitts and Nevis"           , "1"  , 10],
    ["LC", "Saint Lucia"                     , "1"  , 10],
    ["MF", "Saint Martin"                    , "590",  9],
    ["PM", "Saint Pierre and Miquelon"       , "508",  6],
    ["VC", "Saint Vincent and the Grenadines", "1"  , 10],
    ["WS", "Samoa"                           , "685",  7],
    ["SM", "San Marino"                      , "378", 10],
    ["ST", "São Tomé and Príncipe"           , "239",  7],
    ["SA", "Saudi Arabia"                    , "966",  9],
    ["SN", "Senegal"                         , "221",  9],
    ["RS", "Serbia"                          , "381",  9],
    ["SC", "Seychelles"                      , "248",  7],
    ["SL", "Sierra Leone"                    , "232",  8],
    ["SG", "Singapore"                       , "65" ,  8],
    ["SX", "Sint Maarten"                    , "1"  , 10],
    ["SK", "Slovakia"                        , "421",  9],
    ["SI", "Slovenia"                        , "386",  8],
    ["SB", "Solomon Islands"                 , "677",  7],
    ["SO", "Somalia"                         , "252",  8],
    ["ZA", "South Africa"                    , "27" ,  9],
    ["KR", "South Korea"                     , "82" , 10],
    ["SS", "South Sudan"                     , "211",  9],
    ["ES", "Spain"                           , "34" ,  9],
    ["LK", "Sri Lanka"                       , "94" ,  9],
    ["SD", "Sudan"                           , "249",  9],
    ["SR", "Suriname"                        , "597",  7],
    ["SJ", "Svalbard and Jan Mayen"          , "47" ,  8],
    ["SE", "Sweden"                          , "46" ,  9],
    ["CH", "Switzerland"                     , "41" ,  9],
    ["SY", "Syria"                           , "963",  9],
    ["TW", "Taiwan"                          , "886",  9],
    ["TJ", "Tajikistan"                      , "992",  9],
    ["TZ", "Tanzania"                        , "255",  9],
    ["TH", "Thailand"                        , "66" ,  9],
    ["TL", "Timor-Leste"                     , "670",  8],
    ["TG", "Togo"                            , "228",  8],
    ["TK", "Tokelau"                         , "690",  4],
    ["TO", "Tonga"                           , "676",  7],
    ["TT", "Trinidad and Tobago"             , "1"  , 10],
    ["TN", "Tunisia"                         , "216",  8],
    ["TR", "Türkiye"                         , "90" , 10],
    ["TM", "Turkmenistan"                    , "993",  8],
    ["TC", "Turks and Caicos Islands"        , "1"  , 10],
    ["TV", "Tuvalu"                          , "688",  6],
    ["VI", "U.S. Virgin Islands"             , "1"  , 10],
    ["UG", "Uganda"                          , "256",  9],
    ["UA", "Ukraine"                         , "380",  9],
    ["AE", "United Arab Emirates"            , "971",  9],
    ["UZ", "Uzbekistan"                      , "998",  9],
    ["VU", "Vanuatu"                         , "678",  7],
    ["VA", "Vatican City"                    , "379", 10],
    ["VN", "Vietnam"                         , "84" ,  9],
    ["WF", "Wallis and Futuna"               , "681",  6],
    ["EH", "Western Sahara"                  , "212",  9],
    ["YE", "Yemen"                           , "967",  9],
    ["ZM", "Zambia"                          , "260",  9],
    ["ZW", "Zimbabwe"                        , "263",  9],
])

/** The full picker list: priority countries first, then everything else. */
export const COUNTRIES: Country[] = [...PRIORITY_COUNTRIES, ...OTHER_COUNTRIES]

/** Parse an E.164 string into { dialCode, localNumber } or null */
export function parseE164(value: string): { dialCode: string; localNumber: string } | null {
    if (!value || !value.startsWith("+")) return null
    const digits = value.slice(1) // strip "+"
    // Sort by dialCode length descending so longer codes (e.g. "506") match before "50".
    // Array#sort is stable, so equal-length codes keep list order and priority wins.
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
    for (const country of sorted) {
        if (digits.startsWith(country.dialCode)) {
            const local = digits.slice(country.dialCode.length)
            if (local.length <= country.maxDigits) {
                return { dialCode: country.dialCode, localNumber: local }
            }
        }
    }
    return null
}

/** Build an E.164 string from dialCode + localNumber */
export function buildE164(dialCode: string, localNumber: string): string {
    return `+${dialCode}${localNumber}`
}
