#!/usr/bin/env scheme-script
;; Smoke the Chez host without the full Kind compiler blob.
;; Run from bin/scm/src: chez --script host_smoke.scm
(import (kind-host) (chezscheme))

(define failed 0)
(define (ask q p)
  (run_io (vector 'IO.ask q p (lambda (r) (vector 'IO.end r)))))

(define (ok name)
  (display "ok   ") (display name) (newline))

(define (fail name)
  (set! failed (+ failed 1))
  (display "fail ") (display name) (newline))

(define (starts-with? s pref)
  (let ((n (string-length pref)))
    (and (>= (string-length s) n) (string=? (substring s 0 n) pref))))

(let ((h (ask "sha256_ex" "abc")))
  (if (string=? h "0\nba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    (ok "sha256 abc")
    (begin (fail "sha256 abc") (display h) (newline))))

(let ((h (ask "hmac_sha256" "no-nl")))
  (if (string=? h "1\nbad param") (ok "hmac bad param") (fail "hmac bad param")))

(let ((h (ask "hmac_sha256" "\n")))
  (if (starts-with? h "0\nb613679a") (ok "hmac empty") (fail "hmac empty")))

(let ((z (ask "gzip" "hi")))
  (if (starts-with? z "0\n")
    (let ((p (ask "gunzip" (substring z 2 (string-length z)))))
      (if (string=? p "0\nhi") (ok "gzip roundtrip") (fail "gzip roundtrip")))
    (fail "gzip")))

(let ((c (ask "tcp_connect" "")))
  (if (string=? c "1\nbad param") (ok "tcp empty") (fail "tcp empty")))

(let ((c (ask "tcp_connect" "\n80\n0")))
  (if (starts-with? c "1\nbad host") (ok "tcp empty host") (fail "tcp empty host")))

(let ((c (ask "tcp_connect" "a|b\n80\n0")))
  (if (starts-with? c "1\nbad host") (ok "tcp inject host") (fail "tcp inject host")))

(let ((c (ask "tcp_connect" "127.0.0.1\n80\n1")))
  (if (starts-with? c "1\nnot implemented") (ok "tcp tls") (fail "tcp tls")))

(let ((c (ask "tcp_connect" "127.0.0.1\n0\n0")))
  (if (starts-with? c "1\nbad port") (ok "tcp port 0") (fail "tcp port 0")))

(let ((c (ask "tcp_connect" "127.0.0.1\n65536\n0")))
  (if (starts-with? c "1\nbad port") (ok "tcp port hi") (fail "tcp port hi")))

(let ((c (ask "tcp_connect" "127.0.0.1\nabc\n0")))
  (if (starts-with? c "1\nbad port") (ok "tcp port nan") (fail "tcp port nan")))

(let ((c (ask "tcp_send" "nope\nhi")))
  (if (string=? c "1\nclosed") (ok "tcp send closed") (fail "tcp send closed")))

(let ((c (ask "tcp_recv" "nope")))
  (if (string=? c "1\nclosed") (ok "tcp recv closed") (fail "tcp recv closed")))

(let ((c (ask "udp_bind" "0")))
  (if (starts-with? c "1\nnot implemented") (ok "udp stub") (fail "udp stub")))

(let ((c (ask "dns" "localhost")))
  (if (starts-with? c "1\nnot implemented") (ok "dns stub") (fail "dns stub")))

(if (zero? failed)
  (begin (display "All chez host smokes passed.\n") (exit 0))
  (begin (display "chez host smokes failed: ") (display failed) (newline) (exit 1)))
