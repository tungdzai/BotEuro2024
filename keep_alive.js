const http = require('http');
http.createServer(function (req, res) {
    res.write("Notify Shopee");
    res.end();
}).listen(8080);
