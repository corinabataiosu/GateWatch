/**
 * Cele 15 dispozitive ale aeroportului, cu poziția lor în modelul 3D.
 * Identificatorii, zonele și adresele IP corespund registrului simulatorului
 * (simulator/app/devices.py). Producătorul, modelul și firmware-ul sunt date
 * demonstrative; starea curentă vine din SOC atunci când acesta este disponibil.
 */

export type Pozitie3D = [number, number, number]

export type TipDispozitiv = 'camera' | 'nvr' | 'access_control' | 'iot_gateway' | 'vpn_gateway'

export type DispozitivAeroport = {
  id: string
  tip: TipDispozitiv
  denumire: string
  zona: 'terminal' | 'airside' | 'perimeter' | 'operations'
  ip: string
  port: number
  model: string
  firmware: string
  amplasare: string
  pozitie: Pozitie3D
}

export const DISPOZITIVE_AEROPORT: DispozitivAeroport[] = [
  { id: 'CAM-01', tip: 'camera', denumire: 'Terminal — acces principal', zona: 'terminal', ip: '10.20.1.11', port: 80, model: 'Hikvision DS-2CD2143G2', firmware: 'V5.7.12', amplasare: 'Intrarea principală a terminalului', pozitie: [6.5, 0, -5.6] },
  { id: 'CAM-02', tip: 'camera', denumire: 'Terminal — zonă check-in', zona: 'terminal', ip: '10.20.1.12', port: 80, model: 'Hikvision DS-2CD2143G2', firmware: 'V5.7.12', amplasare: 'Zona de check-in, partea vestică a terminalului', pozitie: [-10, 0, -5.6] },
  { id: 'CAM-03', tip: 'camera', denumire: 'Terminal — control securitate', zona: 'terminal', ip: '10.20.1.13', port: 80, model: 'Axis P3245-V', firmware: '10.12.1', amplasare: 'Punctul de control de securitate, aripa vestică', pozitie: [-17, 0, -6.8] },
  { id: 'CAM-04', tip: 'camera', denumire: 'Platformă — poziții parcare', zona: 'airside', ip: '10.20.1.14', port: 80, model: 'Axis Q6135-LE', firmware: '10.12.1', amplasare: 'Pozițiile de parcare a aeronavelor, vest', pozitie: [-12, 0, 4.6] },
  { id: 'CAM-05', tip: 'camera', denumire: 'Platformă — cale de rulare', zona: 'airside', ip: '10.20.1.15', port: 80, model: 'Axis Q6135-LE', firmware: '10.12.1', amplasare: 'Intersecția platformei cu calea de rulare, est', pozitie: [12, 0, 4.6] },
  { id: 'CAM-06', tip: 'camera', denumire: 'Perimetru — gard nord', zona: 'perimeter', ip: '10.20.1.16', port: 80, model: 'Hanwha XNO-8080R', firmware: '2.21.02', amplasare: 'Gardul perimetral, capătul vestic al pistei', pozitie: [-30, 0, 17.5] },
  { id: 'CAM-07', tip: 'camera', denumire: 'Perimetru — poartă acces auto', zona: 'perimeter', ip: '10.20.1.17', port: 80, model: 'Hanwha XNO-8080R', firmware: '2.21.02', amplasare: 'Poarta de acces auto din perimetru, est', pozitie: [30, 0, 17.5] },
  { id: 'CAM-08', tip: 'camera', denumire: 'Operațiuni — sală servere', zona: 'operations', ip: '10.20.1.18', port: 80, model: 'Hikvision DS-2CD2347G2', firmware: 'V5.7.12', amplasare: 'Accesul la sala de servere de lângă turn', pozitie: [17.5, 0, -6.2] },
  { id: 'NVR-01', tip: 'nvr', denumire: 'NVR principal', zona: 'operations', ip: '10.20.2.21', port: 443, model: 'Hikvision DS-9632NI-I8', firmware: 'V4.62.210', amplasare: 'Camera tehnică de la baza turnului', pozitie: [25, 0, -13.5] },
  { id: 'NVR-02', tip: 'nvr', denumire: 'NVR rezervă', zona: 'operations', ip: '10.20.2.22', port: 443, model: 'Hikvision DS-9632NI-I8', firmware: 'V4.62.210', amplasare: 'Camera tehnică de la baza turnului', pozitie: [32, 0, -12] },
  { id: 'ACS-01', tip: 'access_control', denumire: 'Control acces terminal', zona: 'terminal', ip: '10.20.3.31', port: 443, model: 'HID VertX EVO V2000', firmware: '3.7.2.1', amplasare: 'Intrarea personalului în terminal', pozitie: [-1.5, 0, -5.8] },
  { id: 'ACS-02', tip: 'access_control', denumire: 'Control acces platformă', zona: 'airside', ip: '10.20.3.32', port: 443, model: 'HID VertX EVO V2000', firmware: '3.7.2.1', amplasare: 'Poarta hangarului', pozitie: [-27, 0, -3.5] },
  { id: 'ACS-03', tip: 'access_control', denumire: 'Control acces operațiuni', zona: 'operations', ip: '10.20.3.33', port: 443, model: 'HID VertX EVO V2000', firmware: '3.7.2.1', amplasare: 'Sala de servere OPS-2', pozitie: [17, 0, -14] },
  { id: 'IOT-GW-01', tip: 'iot_gateway', denumire: 'Gateway IoT', zona: 'operations', ip: '10.20.0.2', port: 8883, model: 'Siemens SIMATIC IOT2050', firmware: '1.4.1', amplasare: 'Rack de rețea, zona operațiuni', pozitie: [25, 0, -5] },
  { id: 'VPN-GW-01', tip: 'vpn_gateway', denumire: 'Gateway VPN furnizori', zona: 'perimeter', ip: '10.20.0.1', port: 443, model: 'Fortinet FortiGate 60F', firmware: 'FortiOS 7.2.8', amplasare: 'Punctul de intrare în rețea, perimetru', pozitie: [32, 0, -21] },
]

export const ETICHETE_TIP: Record<TipDispozitiv, string> = {
  camera: 'Cameră de supraveghere',
  nvr: 'Înregistrator video (NVR)',
  access_control: 'Control acces',
  iot_gateway: 'Gateway IoT',
  vpn_gateway: 'Gateway VPN',
}
