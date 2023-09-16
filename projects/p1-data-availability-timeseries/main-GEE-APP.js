// *****************************************************************************************
// ***** Image Dates Acquisition Tool - GEE APP CODE *****
// This tool is used to find the available satellite images 
// in a given time period and for a given area of interest.
// 
// The tools is also available as a python version at:
// https://github.com/waleedgeo/geotools/blob/main/tools/01_image_dates/image_dates.ipynb
// 
// Checkout my webpage: https://waleedgeo.com
//
// Author: Mirza Waleed
// Date: 2023-07-01
// Email: waleedgeo@outlook.com
//
// *****************************************************************************************


// Inputs **********************************************************************************

var geometry = ui.import && ui.import("geometry", "geometry", {
    "geometries": [],
    "displayProperties": [],
    "properties": {},
    "color": "#23cba7",
    "mode": "Geometry",
    "shown": true,
    "locked": false
  }) || /* color: #23cba7 */ee.Geometry.MultiPoint();

var startDateInput = ui.Textbox('Start Date (YYYY-MM-dd):')

var endDateInput = ui.Textbox('End Date (YYYY-MM-dd):')


// *****************************************************************************************

var styleBox = {
  padding: '0px 0px 0px 0px',
  width: '250px',
}

var styleH1 = {
  fontWeight: 'bold',
  fontSize: '18px',
  margin: '5px 5px 5px 5px',
  padding: '0px 0px 0px 0px',
  color: 'green'
}

var styleH2 = {
  fontWeight: 'bold',
  fontSize: '14px',
  margin: '5px 5px',
  // padding: '0px 15px 0px 0px',
  color: 'black'
}

var styleP = {
  fontSize: '12px',
  margin: '5px 5px',
  padding: '0px 0px 0px 0px'
}

var symbol = {
  rectangle: '⬛',
  polygon: '🔺',
};

var drawingTools = Map.drawingTools();

drawingTools.setShown(false);

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var nullGeometry =
  ui.Map.GeometryLayer({
      geometries: null,
      name: 'geometry',
      color: '23cba7'
  });

drawingTools.layers().add(nullGeometry);

function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

function drawRectangle() {
  clearGeometry();
  drawingTools.setShape('rectangle');
  drawingTools.draw();
}

function drawPolygon() {
  clearGeometry();
  drawingTools.setShape('polygon');
  drawingTools.draw();
}

var chartPanel = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '4px',
        width: '700px',
        shown: false
    },
  })

//Map.add(chartPanel)



function charting() {

    if (!chartPanel.style().get('shown')) {
        chartPanel.style().set('shown', true);
      }
    
    var aoi = drawingTools.layers().get(0).getEeObject();
 
    drawingTools.setShape(null);
    var startDate = startDateInput.getValue();
    var endDate = endDateInput.getValue();

    var col1 = ee.ImageCollection("COPERNICUS/S1_GRD")
                            .filterDate(startDate, endDate).filterBounds(aoi)
    var col2 = ee.ImageCollection("COPERNICUS/S2")
        .filterDate(startDate, endDate).filterBounds(aoi)
    var col3 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterDate(startDate, endDate).filterBounds(aoi)
    var col4 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterDate(startDate, endDate).filterBounds(aoi)
    
    
    var col1_range = col1.reduceColumns(ee.Reducer.toList(), ["system:time_start"])
        .values().get(0)
    col1_range = ee.List(col1_range)
        .map(function(n){
            return ee.Date(n).format("YYYY-MM-dd")
        })
    var col2_range = col2.reduceColumns(ee.Reducer.toList(), ["system:time_start"])
        .values().get(0)
    col2_range = ee.List(col2_range)
        .map(function(n){
            return ee.Date(n).format("YYYY-MM-dd")
        })
    var col3_range = col3.reduceColumns(ee.Reducer.toList(), ["system:time_start"])
        .values().get(0)
    col3_range = ee.List(col3_range)
        .map(function(n){
            return ee.Date(n).format("YYYY-MM-dd")
        })
    var col4_range = col4.reduceColumns(ee.Reducer.toList(), ["system:time_start"])
        .values().get(0)
    col4_range = ee.List(col4_range)
        .map(function(n){
            return ee.Date(n).format("YYYY-MM-dd")
        })
    
    var all_dates = col1_range.distinct()
                    .cat(col2_range.distinct())
                    .cat(col3_range.distinct())
                    .cat(col4_range.distinct())
                    .distinct().sort()
    
    var col1_dict = col1_range.reduce(ee.Reducer.frequencyHistogram())
    var col1_dict = ee.Dictionary(col1_dict)
    var col2_dict = col2_range.reduce(ee.Reducer.frequencyHistogram())
    var col2_dict = ee.Dictionary(col2_dict)
    var col3_dict = col3_range.reduce(ee.Reducer.frequencyHistogram())
    var col3_dict = ee.Dictionary(col3_dict)
    var col4_dict = col4_range.reduce(ee.Reducer.frequencyHistogram())
    var col4_dict = ee.Dictionary(col4_dict)
    //print(asc_avail_dict, desc_avail_dict)
    
    var col1_feat = col1_dict.map(function(date, n){
        return ee.Feature(ee.Geometry.Point(77.58, 13), {label: date, number_images:n, s1: n, s2: 0, l8:0, l9:0, weight:1})
    }).values()
    var col2_feat = col2_dict.map(function(date, n){
        return ee.Feature(ee.Geometry.Point(77.58, 13), {label: date, number_images:n, s1: 0, s2: n, l8:0, l9:0, weight:1})
    }).values()
    var col3_feat = col3_dict.map(function(date, n){
        return ee.Feature(ee.Geometry.Point(77.58, 13), {label: date, number_images:n, s1: 0, s2: 0, l8:n, l9:0, weight:1})
    }).values()
    var col4_feat = col4_dict.map(function(date, n){
        return ee.Feature(ee.Geometry.Point(77.58, 13), {label: date, number_images:n, s1: 0, s2: 0, l8:0, l9:n, weight:1})
    }).values()
    
    
    
    var comb_feat = col1_feat.cat(col2_feat).cat(col3_feat).cat(col4_feat)
    var comb_col = ee.FeatureCollection(comb_feat);
    //print(comb_col)
    
    // map over dates
    var merged_collection = ee.FeatureCollection(all_dates.map(function(date){
        var new_feat_collection1 = comb_col.filter(ee.Filter.equals('label', date))
        var s1_sum = new_feat_collection1.reduceColumns({
            reducer: ee.Reducer.sum(),
            selectors: ['s1'],
            weightSelectors: ['weight']
            }).get('sum')
        var s2_sum = new_feat_collection1.reduceColumns({
            reducer: ee.Reducer.sum(),
            selectors: ['s2'],
            weightSelectors: ['weight']
            }).get('sum')
        var l8_sum = new_feat_collection1.reduceColumns({
            reducer: ee.Reducer.sum(),
            selectors: ['l8'],
            weightSelectors: ['weight']
            }).get('sum')
        var l9_sum = new_feat_collection1.reduceColumns({
            reducer: ee.Reducer.sum(),
            selectors: ['l9'],
            weightSelectors: ['weight']
            }).get('sum')
        
        var merged = comb_col.filter(ee.Filter.equals('label', date))
        .union().first()
        .set({label:date, s1:s1_sum, s2:s2_sum, l8:l8_sum, l9:l9_sum})
        
        
        return(merged)
    }))
    
    
    // Define the chart and print it to the console.
    var chart = ui.Chart.feature
        .byFeature({
        features: merged_collection.select('s1', 's2', 'l8', 'l9', 'label'),
        xProperty: 'label'
        })
        .setChartType('ColumnChart')
        .setOptions({
        width: 600,
        height: 600,
        title: 'Satellite Image Availability',
        hAxis: {title: 'Dates', titleTextStyle: {italic: false, bold: true}},
        vAxis: {title: 'Number of images',
                titleTextStyle: {italic: false, bold: true}
        },
        colors: ['blue', 'green', 'red', 'purple'],
        isStacked: 'absolute'
        })
    
    chartPanel.widgets().reset([chart]);

}



var panel = {
  title: ui.Label({
      value: 'Satellite Image Availability Tool',
      style: styleH1
  }),
  sec_panel: ui.Label({
      value: 'Satellites: Sentinel-1,2, & Landsat-8,9',
      style: {
          fontWeight: 'bold',
          fontSize: '12px',
          margin: '5px 5px 5px 5px',
          padding: '0px 0px 0px 0px',
          color: 'green'
      }
  }),
  sub_title: ui.Label({
    value: 'Input start and end dates, then draw area and see the available images.',
    style: styleP
    }),
  Time: ui.Label({
    value: 'Time Period :',
    style: {
        fontWeight: 'bold',
        fontSize: '14px',
        margin: '5px 5px',
        // padding: '0px 15px 0px 0px',
        color: 'black'
    }
}),

  area_list: ui.Label({
      value: 'Drawing tools :',
      style: styleH2
  }),
  draw_rectangle: ui.Button({
      label: symbol.rectangle + ' Rectangle',
      onClick: drawRectangle,
      style: {
          stretch: 'horizontal'
      }
  }),
  draw_poly: ui.Button({
      label: symbol.polygon + ' Polygon',
      onClick: drawPolygon,
      style: {
          stretch: 'horizontal'
      }
  }),

}

var panel_fill = ui.Panel({
  widgets: [
      panel.title,
      panel.sec_panel,
      panel.sub_title,
      panel.Time,
      startDateInput,
      endDateInput,
      panel.area_list,
      panel.draw_rectangle,
      panel.draw_poly,
      ui.Label('About :', styleH2),
      ui.Label({
          value: 'Mirza Waleed',
          style: {
              fontWeight: 'bold',
              fontSize: '12px',
              margin: '3px 5px'
          }
      }),
      ui.Label({
          value: 'Email : waleedgeo@outlook.com',
          style: {
              fontSize: '12px',
              margin: '3px 5px'
          }
      }).setUrl('mailto:waleedgeo@outlook.com)'),
      ui.Label({
          value: 'Website: waleedgeo.com',
          style: {
              fontSize: '12px',
              margin: '3px 5px'
          }
      }).setUrl('https://waleedgeo.com'),
      ui.Label({
          value: 'LinkedIn: WaleedGeo',
          style: {
              fontSize: '12px',
              margin: '3px 5px'
          }
      }).setUrl('https://www.linkedin.com/in/waleedgeo'),
      ui.Label({
        value: 'Note: An advanced python version of this tool is also available at:',
        style: {
            fontSize: '12px',
            margin: '3px 5px'
        }
    }),
        ui.Label({
            value: 'Advanced Python Version',
            style: {
                fontSize: '12px',
                margin: '3px 5px'
            }
    }).setUrl('https://github.com/waleedgeo/geotools/blob/main/tools/01_image_dates/image_dates.ipynb'),
  ],
    style: {
      margin: '4px',
      position: 'bottom-left',
      width: '200'
  },

})

// Map.setCenter( 114.88, -1.17,5)
drawingTools.onDraw(ui.util.debounce(charting, 300))
drawingTools.onEdit(ui.util.debounce(charting, 300))

ui.root.add(panel_fill)

ui.root.add(chartPanel)
Map.setCenter(0, 0, 2);