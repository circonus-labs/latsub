## latsub

Completely passive, estimated API/HTTP service latencies via network sniffing and intergration with [Circonus](http://www.circonus.com/).

## Install

<pre>
; make install
; make install-smf
; svccfg import /lib/svc/manifest/site/latsub.xml
; svccfg -s latsub
svc:/circonus/latsub> setprop circonus/check_uuid = astring: "99887766-e09e-410e-aa6c-1a67bd28789a"
svc:/circonus/latsub> setprop circonus/check_secret = astring: "bigchumbawumba"
svc:/circonus/latsub> end
; svcadm enable circonus/latsub
</pre>

## How it works

This service will monitor TCP traffic to port 80 (configurable by editing the manifest to add a port argument to the command).

It looks at each connecting host and measures the roundtrip time of the TCP handshake.  It then wait for the first data payload to be sent.  It tracks the latency (estimated time to first byte) by adding the roundtrip time to the time between the first outbound data payload and the initial SYN.

These latencies are queued up and submitted to Circonus at the provided httptrap UUID/secret.

Due to the calculation method, this will not work for traffic over SSL, but may work for protocols other than HTTP (in which the client speaks first and the server answers).