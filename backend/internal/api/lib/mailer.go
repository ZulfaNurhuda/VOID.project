package lib

import (
	"fmt"
	"net/smtp"
	"os"
)

type Mailer struct {
	host     string
	port     string
	user     string
	password string
	from     string
}

func NewMailer() *Mailer {
	return &Mailer{
		host:     os.Getenv("SMTP_HOST"),
		port:     os.Getenv("SMTP_PORT"),
		user:     os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASSWORD"),
		from:     os.Getenv("SMTP_FROM_EMAIL"),
	}
}

func (m *Mailer) Enabled() bool { return m.host != "" }

func (m *Mailer) Send(to, subject, body string) error {
	if !m.Enabled() {
		return fmt.Errorf("SMTP not configured")
	}
	auth := smtp.PlainAuth("", m.user, m.password, m.host)
	port := m.port
	if port == "" {
		port = "587"
	}
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		m.from, to, subject, body)
	return smtp.SendMail(m.host+":"+port, auth, m.from, []string{to}, []byte(msg))
}
