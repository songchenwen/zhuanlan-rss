
var filesystem = function(){
	if(process.env.VCAP_SERVICES){
		var services = JSON.parse(process.env.VCAP_SERVICES);
		if(services['filesystem-1.0'] && services['filesystem-1.0'].length > 0){
			return services['filesystem-1.0'][0].credentials.host_path;
		}
	}
	return null;
}

exports = module.exports = filesystem;