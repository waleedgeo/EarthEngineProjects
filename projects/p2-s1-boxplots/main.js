// *****************************************************************************************
// 
// This code visualizes the distribution of Sentinel-1 backscatter values
// for each land cover class, using box plots.
// For reference see the tutorial: https://www.youtube.com/watch?v=3Yexo6Q--tk
// Checkout my webpage: https://waleedgeo.com
//
// Author: Mirza Waleed
// Date: 2023-09-16
// Email: waleedgeo@outlook.com
//
// Note:
// The origional credit for this script goes to Ujaval Gandhi, check his work here https://twitter.com/spatialthoughts/status/1690429199562260480
// I have modified it to work with Sentinel-1 data (VV and VH bands) and to work with the WorldCover dataset.
// *****************************************************************************************


// INPUTS **********************************************************************************

var aoi =   ee.Geometry.Polygon([[
    [76.816, 13.006],[76.816, 12.901],
    [76.899, 12.901],[76.899, 13.006]
  ]]);
  
  var startDate = '2021-01-01'
  var endDate = '2022-01-01'
  
  // optional paramters
  
  // chart limits
  var chartMin = -30
  var chartMax = 0
  // sentinel 1 parameters
  var orbitProperties_pass = 'DESCENDING'// 'ASCENDING' or 'DESCENDING'
  
  // --------------------------------------
  
  // 2. Sentinel-1 filtering
  // importing sentinel-1 collection
  var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
          .filter(ee.Filter.eq('orbitProperties_pass', orbitProperties_pass))
          .select(['VV', 'VH'])
          .map(function(image) {
            var edge = image.lt(-30.0);
            var maskedImage = image.mask().and(edge.not());
            return image.updateMask(maskedImage);
          });
  
  var filtered = s1
    .filter(ee.Filter.bounds(aoi))
    .filter(ee.Filter.date(startDate, endDate))
  
    
  // Create a median composite for 2021
  var composite =  filtered.median();
  
  
  // 3. Land cover sampling
  // We use the ESA WorldCover 2021 dataset
  var worldcover = ee.ImageCollection('ESA/WorldCover/v200').first();
  
  // The image has 11 classes
  // Remap the class values to have continuous values
  // from 0 to 10
  var classified = worldcover.remap(
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100],
    [0,  1 , 2,  3,  4,  5,  6,  7,  8,  9,  10]).rename('classification');
  
  // Define a list of class names
  var worldCoverClassNames= [
    'Tree Cover', 'Shrubland', 'Grassland', 'Cropland', 'Built-up',
    'Bare / sparse Vegetation', 'Snow and Ice', 
    'Permanent Water Bodies', 'Herbaceous Wetland', 
    'Mangroves', 'Moss and Lichen'];
  // Define a list of class colors
  var worldCoverPalette = [
    '006400', 'ffbb22', 'ffff4c', 'f096ff', 'fa0000',
    'b4b4b4', 'f0f0f0', '0064c8', '0096a0', '00cf75',
    'fae6a0'];
  // We define a dictionary with class names
  var classNames = ee.Dictionary.fromLists(
    ['0','1','2','3','4','5','6','7','8','9', '10'],
    worldCoverClassNames
  );
  // We define a dictionary with class colors
  var classColors = ee.Dictionary.fromLists(
    ['0','1','2','3','4','5','6','7','8','9', '10'],
    worldCoverPalette
  );
  
  // 4. Sampling and DataTable creation for Box Plots
  // We sample backscatter values from S1 image for each class
  var samples = composite.addBands(classified)
    .stratifiedSample({
      numPoints: 50,
      classBand: 'classification',
      region: aoi, 
      scale: 10,
      tileScale: 16,
      geometries: true
  });
  
  // To create a box plot, we need minimum, maximum,
  // median and 25- and 75-percentile values for
  // each band for each class
  var bands = composite.bandNames();
  var properties = bands.add('classification');
  
  // Now we have multiple columns, so we have to repeat the reducer
  var numBands = bands.length();
  
  // We need the index of the group band
  var groupIndex = properties.indexOf('classification');
  
  // Create a combined reducer for all required statistics
  var allReducers = ee.Reducer.median()
    .combine({reducer2: ee.Reducer.min(), sharedInputs: true} )
    .combine({reducer2: ee.Reducer.max(), sharedInputs: true} )
    .combine({reducer2: ee.Reducer.percentile([25]), sharedInputs: true} )
    .combine({reducer2: ee.Reducer.percentile([75]), sharedInputs: true} )
  
  // Repeat the combined reducer for each band and
  // group results by class
  var stats = samples.reduceColumns({
      selectors: properties,
      reducer: allReducers.repeat(numBands).group({
        groupField: groupIndex}),
  });
  var groupStats = ee.List(stats.get('groups'));
  print(groupStats);
  
  // We do some post-processing to format the results
  
  var spectralStats = ee.FeatureCollection(groupStats.map(function(item) {
    var itemDict = ee.Dictionary(item);
    var classNumber = itemDict.get('group');
    // Extract the stats
    // Create a featute for each statistics for each class
    var stats = ee.List(['median', 'min', 'max', 'p25', 'p75']);
    // Create a key such as VV_min, VV_max, etc.
    var keys = stats.map(function(stat) {
      var bandKeys = bands.map(function(bandName) {
        return ee.String(stat).cat('_').cat(bandName);
        })
      return bandKeys;
      }).flatten();
    // Extract the values  
    var values = stats.map(function(stat) {
      return itemDict.get(stat);
    }).flatten();
    var properties = ee.Dictionary.fromLists(keys, values);
    var withClass = properties
      .set('class', classNames.get(classNumber))
      .set('class_number', classNumber);
    return ee.Feature(null, withClass);
  }));
  
  
  // 5. Charting
  // Now we need to create a backscatter signature chart
  // for each class.
  
  // Write a function to create a chart for each class
  var createChart = function(className) {
    var classFeature = spectralStats.filter(ee.Filter.eq('class', className)).first();
    var classNumber = classFeature.get('class_number');
    var classColor = classColors.get(classNumber);
    // X-Axis has Band Names, so we create a row per band
    var rowList = bands.map(function(band) {
      var stats = ee.List(['median', 'min', 'max', 'p25', 'p75']);
      var values = stats.map(function(stat) {
        var key = ee.String(stat).cat('_').cat(band);
        var value = classFeature.get(key);
        return {v: value}
      });
      // Row name is the first value
      var rowValues = ee.List([{v: band}]);
      // Append other values
      rowValues = rowValues.cat(values);
  
      var rowDict = {
        c: rowValues
      };
    return rowDict;
    });
    // We need to convert the server-side rowList and 
    // classColor objects to client-side javascript object
    // use evaluate()
    rowList.evaluate(function(rowListClient) {
      classColor.evaluate(function(classColor) {
         var dataTable = {
          cols: [
            {id: 'x', type: 'string', role: 'domain'},
            {id: 'median', type: 'number', role: 'data'},
            {id: 'min', type: 'number', role: 'interval'},
            {id: 'max', type: 'number', role: 'interval'},
            {id: 'firstQuartile', type: 'number', role: 'interval'},
            {id: 'thirdQuartile', type:'number', role: 'interval'},
          ],
          rows: rowListClient
        };
      
        var options = {
          title:'BackScatter Profile for Class: ' + className,
          vAxis: {
            title: 'Backscatter (dB)',
            gridlines: {
              color: '#d9d9d9'
            },
            minorGridlines: {
              color: 'transparent'
            },
            viewWindow: {
              min:chartMin,
              max:chartMax
            }
          },
          hAxis: {
            title: 'Bands',
            gridlines: {
              color: '#d9d9d9'
            },
            minorGridlines: {
              color: 'transparent'
            }
          },
          legend: {position: 'none'},
          lineWidth: 1,
          interpolateNulls: true,
          curveType: 'function',
          series: [{'color': classColor}],
          intervals: {
            barWidth: 0.5,
            boxWidth: 0.5,
            lineWidth: 1,
            style: 'boxes',
            fillOpacity: 1,
  
          },
          interval: {
            min: {
              style: 'bars',
            },
            max: {
              style: 'bars',
            }
        },
          chartArea: {left:100, right:100}
        };
          
        var chart = ui.Chart(dataTable, 'LineChart', options);
        print(chart);
        });
  
      })
     
  
  };
  
  // We get a list of classes
  var classNames = spectralStats.aggregate_array('class');
  // Call the function for each class name to create the chart
  print('Creating charts. Please wait...');
  classNames.evaluate(function(classNames) {
    for (var i = 0; i < classNames.length; i++) {
      createChart(classNames[i]);
    }
  });
  Map.centerObject(aoi, 12);
  Map.addLayer(aoi, {color: 'gray'}, 'AOI');
  var rgbVis = {min: -25, max: 5, bands: ['VV', 'VV', 'VH']};
  Map.addLayer(composite.clip(aoi), rgbVis, '2020 Composite');
  var worldCoverVisParams = {min:0, max:10, palette: worldCoverPalette};
  Map.addLayer(classified.clip(aoi), worldCoverVisParams, 'Landcover');
  print('Stratified Samples', samples);
  Map.addLayer(samples, {color: 'red'}, 'Samples');
  print('Average Backscatter Values for Each Class', spectralStats);