import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:             process.env.SMTP_HOST ?? "smtp.gmail.com",
  port:             Number(process.env.SMTP_PORT ?? 587),
  secure:           process.env.SMTP_SECURE === "true",
  connectionTimeout: 10_000,   // 10s 连接超时
  greetingTimeout:   5_000,    // 5s 握手超时
  socketTimeout:     10_000,   // 10s 读写超时
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, code: string) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to,
    subject: "Enterprise OpenClaw 登录验证码",
    text:    `您的登录验证码是：${code}，5 分钟内有效，请勿分享给他人。`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111;color:#eee;border-radius:8px">
  <h2 style="margin:0 0 16px;font-size:18px">Enterprise OpenClaw 登录验证码</h2>
  <p style="margin:0 0 24px;color:#aaa;font-size:14px">请在登录页面输入以下验证码：</p>
  <div style="font-size:36px;font-weight:700;letter-spacing:12px;text-align:center;
              background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:20px">
    ${code}
  </div>
  <p style="margin:24px 0 0;color:#666;font-size:12px">验证码 5 分钟内有效，请勿分享给他人。</p>
</div>`,
  });
}
