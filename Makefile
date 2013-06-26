NODE=node
NPM=npm

all:

install:
	mkdir -p $(DESTDIR)/opt/circonus/bin
	(cd $(DESTDIR)/opt/circonus/bin && $(NPM) install lazy)
	cp latsub.js $(DESTDIR)/opt/circonus/bin/latsub.js
	chmod 755 $(DESTDIR)/opt/circonus/bin/latsub.js

install-smf:
	mkdir -p $(DESTDIR)/lib/svc/manifest/site
	cp latsub.xml $(DESTDIR)/lib/svc/manifest/site/latsub.xml
	chmod 444 $(DESTDIR)/lib/svc/manifest/site/latsub.xml
