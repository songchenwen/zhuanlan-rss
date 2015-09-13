
var sortRss = function(items){
	items.sort(function(a, b){
		return b.date - a.date;
	});
};

module.exports = sortRss;
