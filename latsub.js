#!/usr/bin/env node
var Lazy=require("lazy"),
    fs=require("fs"),
    os=require("os"),
    https=require("https"),
    util=require("util"),
    child_process=require("child_process"),
    lats=[], syn={}, ack={}, data={},
    hostname = os.hostname(),
    desired_port = 80,
    tcpdump = process.env['TCPDUMP'] || "/usr/sbin/tcpdump",
    uuid, secret;

if (process.argv.length < 4) {
  console.log(process.argv[1], "<uuid>", "<secret>");
  process.exit(-1);
}

var sb;
try { sb = fs.statSync(tcpdump); } catch(e) {}
if(!sb || !sb.isFile()) {
  console.log("tcpdump: " + tcpdump + " not found");
  console.log("HINT: set the TCPDUMP environment variable");
  process.exit(-1);
}

uuid = process.argv[2];
secret = process.argv[3];
if(process.argv.length == 5) desired_port = process.argv[4];

var tcpdump_args = [
  "-n" ,"-tt", "-s", "384",
  "((((ip[2:2] - ((ip[0]&0xf)*4)) - ((tcp[12]&0xf0)/4)) == 0) && " +
    " ((tcp[tcpflags] & (tcp-syn|tcp-ack)) != 0) and dst port " + desired_port + ")" +
    "or (((ip[2:2] - ((ip[0]&0xf)*4)) - ((tcp[12]&0xf0)/4)) != 0 and src port " + desired_port + ")"
];

var child = child_process.spawn(tcpdump, tcpdump_args);

child.on('close', function (code) {
  console.log('child process exited with code ' + code);
  process.exit(-1);
});

var epoch = (new Date()).getTime()/1000;
new Lazy(child.stdout)
  .lines
  .forEach(
    function(line) {
      var l = line.toString();
      var parts = /^(\d+)\.(\d+) IP (\d+\.\d+\.\d+\.\d+\.(\d+)) > (\d+\.\d+\.\d+\.\d+\.(\d+)): Flags \[([^\]]+)\]/.exec(l);
      if(parts) {
        var ts = (1000000 * (parseFloat(parts[1])-epoch)) + parseFloat(parts[2]),
            port1 = parts[4], len = 0,
            src = (parts[4] == desired_port) ? parts[5] : parts[3];
        var lenm = /length (\d+)$/.exec(l);
        if(lenm) len = lenm[1];
        if(!syn[src] && parts[7] == 'S') syn[src]=ts;
        else if(syn[src] && !ack[src] && len == 0) ack[src]=(ts-syn[src]);
        else if(syn[src] && ack[src] && !data[src] && len > 0) {
          var latency = (ts - syn[src]) + ack[src];
          lats.push(latency/1000000);
          delete(syn[src]);
          delete(ack[src]);
          delete(data[src]);
        }
        else {
          delete(syn[src]);
          delete(ack[src]);
          delete(data[src]);
        }
      }
    }
  );

function publish() {
  if(lats.length == 0) return;
  var b = lats;
  lats = [];
  var struct = {
   aggregate: { "latency": { "_type": "n", "_value": b } }
  };
  struct[hostname] = { "latency": { "_type": "n", "_value": b } };

  var options = {
    hostname: 'trap.noit.circonus.net',
    port: 443,
    path: '/module/httptrap/' + uuid + '/' + secret,
    method: 'PUT',
    ca:
"-----BEGIN CERTIFICATE-----\n" +
"MIID4zCCA0ygAwIBAgIJAMelf8skwVWPMA0GCSqGSIb3DQEBBQUAMIGoMQswCQYD\n" +
"VQQGEwJVUzERMA8GA1UECBMITWFyeWxhbmQxETAPBgNVBAcTCENvbHVtYmlhMRcw\n" +
"FQYDVQQKEw5DaXJjb251cywgSW5jLjERMA8GA1UECxMIQ2lyY29udXMxJzAlBgNV\n" +
"BAMTHkNpcmNvbnVzIENlcnRpZmljYXRlIEF1dGhvcml0eTEeMBwGCSqGSIb3DQEJ\n" +
"ARYPY2FAY2lyY29udXMubmV0MB4XDTA5MTIyMzE5MTcwNloXDTE5MTIyMTE5MTcw\n" +
"NlowgagxCzAJBgNVBAYTAlVTMREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMI\n" +
"Q29sdW1iaWExFzAVBgNVBAoTDkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJj\n" +
"b251czEnMCUGA1UEAxMeQ2lyY29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4w\n" +
"HAYJKoZIhvcNAQkBFg9jYUBjaXJjb251cy5uZXQwgZ8wDQYJKoZIhvcNAQEBBQAD\n" +
"gY0AMIGJAoGBAKz2X0/0vJJ4ad1roehFyxUXHdkjJA9msEKwT2ojummdUB3kK5z6\n" +
"PDzDL9/c65eFYWqrQWVWZSLQK1D+v9xJThCe93v6QkSJa7GZkCq9dxClXVtBmZH3\n" +
"hNIZZKVC6JMA9dpRjBmlFgNuIdN7q5aJsv8VZHH+QrAyr9aQmhDJAmk1AgMBAAGj\n" +
"ggERMIIBDTAdBgNVHQ4EFgQUyNTsgZHSkhhDJ5i+6IFlPzKYxsUwgd0GA1UdIwSB\n" +
"1TCB0oAUyNTsgZHSkhhDJ5i+6IFlPzKYxsWhga6kgaswgagxCzAJBgNVBAYTAlVT\n" +
"MREwDwYDVQQIEwhNYXJ5bGFuZDERMA8GA1UEBxMIQ29sdW1iaWExFzAVBgNVBAoT\n" +
"DkNpcmNvbnVzLCBJbmMuMREwDwYDVQQLEwhDaXJjb251czEnMCUGA1UEAxMeQ2ly\n" +
"Y29udXMgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MR4wHAYJKoZIhvcNAQkBFg9jYUBj\n" +
"aXJjb251cy5uZXSCCQDHpX/LJMFVjzAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEB\n" +
"BQUAA4GBAAHBtl15BwbSyq0dMEBpEdQYhHianU/rvOMe57digBmox7ZkPEbB/baE\n" +
"sYJysziA2raOtRxVRtcxuZSMij2RiJDsLxzIp1H60Xhr8lmf7qF6Y+sZl7V36KZb\n" +
"n2ezaOoRtsQl9dhqEMe8zgL76p9YZ5E69Al0mgiifTteyNjjMuIW\n" +
"-----END CERTIFICATE-----\n"
  };
  var req = https.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      if(res.statusCode != 200) console.log('BODY: ' + chunk);
    });
  });
  req.write(JSON.stringify(struct));
  req.end();
}
setInterval(publish, 500);
