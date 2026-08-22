export type VerificationEmail = {
  subject: string
  text: string
  html: string
}

export function verificationEmail(otp: string): VerificationEmail {
  return {
    subject: 'HRack email verification code / 邮箱验证码',
    text: [
      `Your HRack verification code is ${otp}. It expires in 10 minutes.`,
      '',
      `您的 HRack 邮箱验证码是 ${otp}，10 分钟内有效。`,
      '',
      'If you did not request this code, you can ignore this email.',
      '如果这不是您的操作，请忽略此邮件。'
    ].join('\n'),
    html: [
      '<p>Your HRack verification code is:</p>',
      `<p><strong style="font-size:24px;letter-spacing:0.18em">${otp}</strong></p>`,
      '<p>It expires in 10 minutes.</p>',
      '<hr>',
      '<p>您的 HRack 邮箱验证码：</p>',
      `<p><strong style="font-size:24px;letter-spacing:0.18em">${otp}</strong></p>`,
      '<p>验证码 10 分钟内有效。如果这不是您的操作，请忽略此邮件。</p>'
    ].join('')
  }
}
