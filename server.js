(function () {
    "use strict";
    const express = require('express');
    const boxIntersect = require('box-intersect');
    const bodyParser = require('body-parser');
    const compression = require('compression');
    const app = express();
    const http = require('http');
    const useragent = require('useragent');

    const port = 3004;
    app.use(compression());
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(express.static(__dirname));

    const geovolumes_server_url = `http://localhost:${port}`
    // const geovolumes_server_url = "https://steinbeis-3dps.eu/3DGeoVolumes"
    // GeoVolume - A function to replace the geovolumes_server_url
    var replace_server_url = function (const_json) {
        var input_str = JSON.stringify(const_json)
        input_str = input_str.replace(/host_url/g, geovolumes_server_url);
        var input_output = JSON.parse(input_str)
        return input_output;
    }

    // GeoVolume Check if bbox intersection
    // This version only check 2D !!!!
    var validate_bbox = function (collections_input, req) {
        if (typeof req.query.bbox == "string") {

            try {
                // user request with bbox
                // var collections_json = JSON.parse(collections_input);
                var collections_json = collections_input;
                var req_query_bbox = req.query.bbox;
                var bbox = JSON.parse("[" + req_query_bbox + "]");
                // remove the req-height if exist
                if (config.server_full_log) {
                    console.log(`bbox lenght: ${bbox.lenght}`)
                }
                if (bbox.length == 6) {
                    bbox = [bbox[0], bbox[1], bbox[3], bbox[4]]
                } else if (bbox.lenght == 0 || typeof bbox.lenght == 'undefined') {
                    return collections_input
                }
                // prepare result array
                var resultJSON = {}
                resultJSON["links"] = collections_json["links"]
                resultJSON["collections"] = [] // prepare empty collection

                for (let index = 0; index < collections_json["collections"].length; index++) {
                    var collection_bbox_minx = collections_json["collections"][index].extent.spatial.bbox[0][0]
                    var collection_bbox_miny = collections_json["collections"][index].extent.spatial.bbox[0][1]
                    var collection_bbox_maxx = collections_json["collections"][index].extent.spatial.bbox[0][3]
                    var collection_bbox_maxy = collections_json["collections"][index].extent.spatial.bbox[0][4]
                    var bbox_collection = [];
                    bbox_collection.push(collection_bbox_minx)
                    bbox_collection.push(collection_bbox_miny)
                    bbox_collection.push(collection_bbox_maxx)
                    bbox_collection.push(collection_bbox_maxy)
                    var boxes = [bbox, bbox_collection];
                    var overlap = boxIntersect(boxes);
                    if (overlap == '') {} else {
                        resultJSON["collections"].push(collections_json["collections"][index])
                    }
                    if (index == collections_json["collections"].length - 1) {
                        // Return only the last loop
                        return resultJSON
                    }
                }

            } catch (error) {
                console.log(`Error in the BBOX function validate_bbox() :`)
                console.log(error)
                return collections_input
            }

        } else {
            // user request without bbox
            return collections_input
        }
    }

    app.get('/', function (req, res) {
        var landingpage_json = require('./3DGeoVolumes/landingpage.json')
        var landingpage_output = replace_server_url(landingpage_json)
        try {
            var agent = useragent.parse(req.headers['user-agent']);
            var agentString = agent.toString()
            if (req.query.f === "json" || req.query.format === "json" || agentString.includes("Other")) {
                res.json(landingpage_output);
            } else {
                // browser
                res.render('geovolumes/landing.ejs', {
                    landingpage_output
                })
            }
        } catch (error) {
            console.log(error)
        }

    })

    // GeoVolume - conformance
    const conformance_json = require('./3DGeoVolumes/conformance.json')
    app.get('/conformance', function (req, res) {
        res.json(conformance_json);
    })

    // GeoVolume - Collections
    app.get('/collections', function (req, res) {
        try {
            var collection_resource = require('./3DGeoVolumes/collections/collections.json')
            var collection_resource_updated = replace_server_url(collection_resource)
            var collection_resource_updated_bbox = validate_bbox(collection_resource_updated, req)

            // check user-agent
            var agent = useragent.parse(req.headers['user-agent']);
            var agentString = agent.toString()
            console.log(`request agent: ${agentString}`)
            if (req.query.f === "json" || req.query.format === "json" || agentString.includes("Other")) {
                res.json(collection_resource_updated_bbox);
            } else {
                // browser
                res.render('geovolumes/collections.ejs', {
                    collection_resource_updated_bbox
                })
            }
        } catch (error) {
            console.log(error)
        }

    })

    app.get('/collections/:collectionsId', function (req, res) {
        try {
            var collection_resource = require('./3DGeoVolumes/collections/collections.json')
            var collection_resource_updated = replace_server_url(collection_resource)
            var selected_collection_byID = []
            for (let index = 0; index < collection_resource_updated.collections.length; index++) {
                if (collection_resource_updated.collections[index]["id"] == req.params.collectionsId) {
                    selected_collection_byID.push(collection_resource_updated.collections[index])
                }
            }
            var selected_collection = {
                "links": [
                  {
                    "rel": "self",
                    "href": `host_url/collections/${req.params.collectionsId}`,
                    "type": "application/json",
                    "title": `OGC API - 3D GeoVolumes collections of ${req.params.collectionsId}`
                  }
                ],
                "collections": selected_collection_byID
            }
            selected_collection = replace_server_url(selected_collection)
            res.json(selected_collection);
        } catch (error) {
            console.log(error)
            res.send("internal error")
        }
    })
    // request 3D Tiles
    app.get('/collections/:collectionsId/3dtiles', function (req, res) {
        try {
                var collections_3dtiles_json = require(`./3DGeoVolumes/collections/${req.params.collectionsId}/3dtiles/tileset.json`)
                var collections_3dtiles_output = replace_server_url(collections_3dtiles_json)
                res.json(collections_3dtiles_output);
        } catch (error) {
            console.log(error)
            res.send("internal error")
        }
    })


    app.get('/collections/:collectionsId/:containerId', function (req, res) {
        try {
            var collection_json = require(`./3DGeoVolumes/collections/${req.params.collectionsId}/${req.params.containerId}/${req.params.containerId}.json`)
            res.json(collection_json);
        } catch (error) {
            res.send("internal error at /3DGeoVolumes/collections/:collectionsId/:containerId")
        }
    })
    app.get('/collections/:collectionsId/:containerId/3dtiles', function (req, res) {
        try {
                var collections_3dtiles_json = require(`./3DGeoVolumes/collections/${req.params.collectionsId}/${req.params.containerId}/tileset.json`)
                var collections_3dtiles_output = replace_server_url(collections_3dtiles_json)
                res.json(collections_3dtiles_output);
        } catch (error) {
            console.log(error)
            res.send("internal error")
        }
    })
    
    app.get('/i3s', function (req, res) {
        if (req.query.i3s_resource_url) {
            res.render('arcgisclient.ejs', 
                req.query
            )
        } else {
            res.send("Error: no i3s query parameter specified")
        }
    })
    app.get('/3dtiles', function (req, res) {
        if (req.query.url_3dtiles_json) {
            res.render('cesiumclient.ejs', 
                req.query
            )
        } else {
            res.send("Error: no url_3dtiles_json parameter specified")
        }
    })
    app.use(express.static("static"));
    app.use(express.static("3DGeoVolumes"));

    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
        console.log(`HTTP Server running on port ${port}`);
        console.log(`server at http://:${port}/`);
    })
})();