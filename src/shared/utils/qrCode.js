import QRCode from 'qrcode'

const QR_CODE_OPTIONS = {
  errorCorrectionLevel: 'M',
  margin: 0,
  type: 'image/png',
  width: 256,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
}

export function createQrCodeDataUrl(text) {
  if (!text) return Promise.resolve('')

  return QRCode.toDataURL(String(text), QR_CODE_OPTIONS)
}
