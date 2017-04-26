/* globals Chart */
var app = window.app || {};

app = {
	graph: 0,

	//global variables for tax calculation
	taxyear: '',
	married: 0,

    init: function() {
        'use strict';
        var self = this;
        self.initPage();
        self.initClicks();
        self.initFormControls();
    },
	//do some initial configuring of the page elements
    initPage: function(){
		jQuery('.taxcalcstep').hide();
		jQuery('[data-reset]').hide();
		jQuery('.taxcalcstep:first').show();
		jQuery('#tc').find(':radio').prop('checked', false);
	},
	//js based styling control for radio buttons
    initFormControls: function(){
		jQuery('.js-radiocheck').on('change','input[type="radio"]',function(){
			var thisname = jQuery(this).attr('name');
			var parents = jQuery('input[name=' + thisname + ']').closest('label');
			parents.removeClass('selected');
			jQuery(this).closest('label').addClass('selected');

		});
	},
	initClicks: function(){
		//deal with the branching route nature of the system from the first step
		jQuery('.js-selectemployment').on('click',function(){
			var targ = jQuery(this).attr('data-target');
			jQuery('.js-btnemployee').attr('data-target',targ);
		});

		//deal with some fields having optional required options only if the value is greater than zero
		jQuery('.js-associatedoption').on('focus',function(){
			var targ = jQuery(this).attr('data-target');
			if(!jQuery('[name=' + targ + ']').is(':checked')){
				jQuery('#' + targ).prop('checked',true).change();
			}
		});
		
		jQuery('.js-back').on('click',function(e){
			e.preventDefault();
			var goback = jQuery('#firstbutton').attr('data-target');
			jQuery('.taxcalcstep').hide();
			jQuery('#' + goback).show();
			jQuery('html,body').animate({scrollTop: jQuery('#' + goback).offset().top}, 800);
		});

		//click button, go to next step
		jQuery('.js-nextstep').on('click',function(e){
			e.preventDefault();
			var thisel = jQuery(this);
			var errormsg = thisel.attr('data-error');
			var nextstep = thisel.attr('data-target');
			var parentel = thisel.attr('data-parent');
			jQuery('.alert').remove();
			
			var fields = jQuery('#' + parentel).find('[data-required]');
			var filled = 1; //if 1, continue, but first check if any required field is incomplete
			var errors = [];
			fields.each(function(){
				var herenow = jQuery(this);
				var val = 0;
				if(herenow.is(':radio')){
					var checkit = herenow.attr('name');
					checkit = jQuery('[name="' + checkit + '"]');
					if(!checkit.is(':checked')){
						filled = 0;
						errors.push(herenow.closest('.field'));
					}
				}
				else {
					if(!herenow.val()){
						filled = 0;
						errors.push(herenow.closest('.field'));
					}
				}
			});
			if(filled){
				jQuery('.taxcalcstep').hide();
				jQuery('.field.error').removeClass('error');
				if(typeof thisel.attr('data-reset') !== 'undefined'){ //go back to start
					jQuery('#tc').find('input[type="radio"]').prop('checked',false).change().closest('label').removeClass('selected'); //reset all radios and label classes
					jQuery('.js-btnemployee').prop('data-target',false);
					//fixme also reset all text inputs
					jQuery('#tc').find('input[type=text],input[type=number]').val('');
					jQuery('[data-reset]').hide();
				}
				jQuery('#' + nextstep).show(function(){
					if(typeof thisel.attr('data-final') !== 'undefined'){ //do final calculation
						app.calculateTax(thisel.attr('data-final'));
						jQuery('[data-reset]').show();
					}
				});
				jQuery('html,body').animate({scrollTop: jQuery('#' + nextstep).offset().top}, 800);
			}
			else {
				//user has not filled everything in
				var whoops = jQuery('<div/>').addClass('alert alert-error').html(errormsg);
				thisel.before(whoops);
				jQuery('.field').removeClass('error');
				for(var x = 0; x < errors.length; x++){
					errors[x].addClass('error');
				}
			}
		});
	},

	//do the tax calculation and display the pie chart
    calculateTax: function(employmenttype){
		var expenses = 0;
		var allowances = parseInt(jQuery('#opt_empl_allowances').val());
		var deductions = parseInt(jQuery('#opt_empl_deductions').val());
		app.taxyear = jQuery('#opt_taxyear').val();
		var studentloan = 0; //FIXME this is a bit odd, we just have a checkbox and assume that gets paid all year, rather than basing it on an amount outstanding
		//var dividends = 0;
		//var dividendtaxpaid = 0;
		app.married = parseInt(jQuery('input[name=opt_empl_married]:checked').val());
		var takehomepay;
		var natinspaid = 0;
		var bonuses = 0;
		var incometaxpaid;
		var taxableincome;

		//inputs - values change depending on if employed or self employed
		var elincome = jQuery('#opt_empl_annualsalary');
		var elage = jQuery('#opt_empl_age');
		var elblind = jQuery('input[name=opt_empl_blindallow]:checked');
		var elchildcaretype = jQuery('[name="opt_empl_childcare"]:checked');
		var elchildcarevouchers = jQuery('#opt_empl_childcarevalue');
		var elpensionvalue = jQuery('#opt_empl_pensionvalue');
		var elpensiontype = jQuery('input[name=opt_empl_pension]:checked');
		var elstudentloan = jQuery('[name="opt_empl_studentloan"]:checked');
		var eldeductions = 0;

		if(employmenttype === 'selfemployed'){
			elincome = jQuery('#opt_self_income');
			elage = jQuery('#opt_self_age');
			elblind = jQuery('input[name=opt_self_blindallow]:checked');
			elchildcaretype = jQuery('[name="opt_self_childcare"]:checked');
			elchildcarevouchers = jQuery('#opt_self_childcarevalue');
			elpensionvalue = jQuery('#opt_self_pensionvalue');
			elpensiontype = jQuery('input[name=opt_self_pension]:checked');
			elstudentloan = jQuery('[name="opt_self_studentloan"]:checked');
			eldeductions = jQuery('#opt_self_benefits');
		}

		//calculate gross income
		var income = parseInt(elincome.val());
		var grossincome = income;
		if(employmenttype === 'selfemployed'){
			/*
			dividends = parseInt(jQuery('#opt_self_dividend').val());
			dividendtaxpaid = app.calculateDividendTax(dividends,app.taxyear);
			grossincome += dividends;
			*/
		}
		else {
			bonuses = parseInt(jQuery('#opt_empl_bonuses').val()); //only valid for employed
			grossincome += bonuses;
		}
		var childcarevouchers = app.calculateChildcare(parseInt(elchildcarevouchers.val()),elchildcaretype);

		var pensionraw = parseInt(elpensionvalue.val());
		var pensionresult = app.calculatePension(elpensiontype,grossincome,pensionraw);
		var pensionamount = pensionresult[0];
		//var pensionpercent = pensionresult[1];

		var outputdata = [];
		var personalallowance = 0;

		//if user has chosen 'self employed'
		if(employmenttype === 'selfemployed'){
			deductions = parseInt(eldeductions.val());
			//income = parseInt(jQuery('#opt_self_income').val());
			expenses = parseInt(jQuery('#opt_self_expenses').val());
			if(parseInt(elstudentloan.val())){
				studentloan = app.calculateStudentLoan(grossincome - childcarevouchers - expenses);
			}
			var profits = Math.max(grossincome - expenses,0);
			//taxableincome = Math.max(profits - childcarevouchers - pensionamount - personalallowance,0);
			taxableincome = Math.max(profits - deductions,0);
			personalallowance = app.calculatePersonalAllowance(taxableincome,parseInt(elage.val()),parseInt(elblind.val()),app.taxyear);
			taxableincome -= personalallowance;
			console.log('profits:',profits,'deductions:',deductions,'childcarevouchers:',childcarevouchers,'pensionamount:',pensionamount,'personalallowance:',personalallowance);
			console.log('Taxable:',taxableincome);

			var grosspencontrib = (pensionamount * 100) /80;
			console.log('Gross pension contrib:',grosspencontrib,pensionamount);
			incometaxpaid = app.calculateIncomeTax(taxableincome,app.married,app.taxyear,parseInt(elage.val()),grosspencontrib);
			//console.log('Profits:',profits,'taxable income:',taxableincome,'income tax paid:',incometaxpaid,'dividend tax:',dividendtaxpaid);
			if(parseInt(jQuery('[name="opt_self_natins"]:checked').val())){
				natinspaid = app.calculateNatinsSelfEmployed(profits - deductions,app.taxyear);
			}
			//takehomepay = Math.max((profits + dividends) - incometaxpaid - dividendtaxpaid - natinspaid,0);
			takehomepay = Math.max(profits - incometaxpaid - natinspaid - childcarevouchers - pensionamount - studentloan,0);

			//create all the output data
			outputdata.push({'label':'Total income','val':app.round2Fixed(grossincome),'inpie':0});
			outputdata.push({'label':'Tax on income','val':app.round2Fixed(incometaxpaid),'inpie':1});
			//outputdata.push({'label':'Tax on dividends','val':app.round2Fixed(dividendtaxpaid),'inpie':1});
			outputdata.push({'label':'Take home pay','val':app.round2Fixed(takehomepay),'inpie':1});
			outputdata.push({'label':'National Insurance','val':app.round2Fixed(natinspaid),'inpie':1});
			outputdata.push({'label':'Student loan','val':app.round2Fixed(studentloan),'inpie':1});
			outputdata.push({'label':'Pension','val':app.round2Fixed(pensionamount),'inpie':1});
			outputdata.push({'label':'Childcare Vouchers','val':app.round2Fixed(childcarevouchers),'inpie':1});
		}
		//if user has chosen 'employed'
		else {
			if(parseInt(elstudentloan.val())){
				studentloan = app.calculateStudentLoan(grossincome - deductions - childcarevouchers - expenses);
			}
			//taxableincome = Math.max(grossincome + allowances - deductions - childcarevouchers - pensionamount - personalallowance,0);
			personalallowance = app.calculatePersonalAllowance(parseInt(elincome.val()),parseInt(elage.val()),parseInt(elblind.val()),app.taxyear);
			//taxableincome = Math.max(grossincome + allowances - childcarevouchers - pensionamount - personalallowance,0);
			taxableincome = Math.max(grossincome - childcarevouchers - pensionamount - (personalallowance + allowances),0);
			console.log('GrossIncome:',grossincome,'Allowances:',allowances,'Deductions:',deductions,'Childcare:',childcarevouchers,'Pension:',pensionamount,'PA:',personalallowance);
			console.log('this step:', grossincome - childcarevouchers - pensionamount - (personalallowance + allowances));
			//console.log('Taxable:',taxableincome);

			incometaxpaid = app.calculateIncomeTax(taxableincome,app.married,app.taxyear,parseInt(elage.val()),0);
			if(parseInt(jQuery('[name="opt_empl_natins"]:checked').val())){
				natinspaid = app.calculateNatins(grossincome,deductions,childcarevouchers);
			}
			takehomepay = Math.max(grossincome - incometaxpaid - natinspaid - studentloan - childcarevouchers - pensionamount,0);

			//create all the output data
			outputdata.push({'label':'Total income','val':app.round2Fixed(grossincome),'inpie':0});
			outputdata.push({'label':'Income tax','val':app.round2Fixed(incometaxpaid),'inpie':1});
			outputdata.push({'label':'Take home pay','val':app.round2Fixed(takehomepay),'inpie':1});
			outputdata.push({'label':'National Insurance','val':app.round2Fixed(natinspaid),'inpie':1});
			outputdata.push({'label':'Student loan','val':app.round2Fixed(studentloan),'inpie':1});
			outputdata.push({'label':'Pension','val':app.round2Fixed(pensionamount),'inpie':1});
			outputdata.push({'label':'Childcare Vouchers','val':app.round2Fixed(childcarevouchers),'inpie':1});
		}
		app.generatePieChart(outputdata,grossincome);
	},

	//create the pie chart data from the output data
	generatePieChart: function(outputdata,grossincome){
		var piedata = [];
		var loopcol = 0;
		var outputtarg = jQuery('#numberoutput');
		outputtarg.html('');
		var outputdt = jQuery('<dt/>');
		var outputdd = jQuery('<dd/>');
		//colours to use for income tax, take home pay, national insurance, student loan, pension, childcare
		var outputcols = ['#3661bb','#349d2d','#c22d76','#a5d002','#0098cd','#808080','#7f3c83'];
		var outputhicols = ['#5c7abb','#529d4d','#c2538a','#aed02c','#29a3cd','#b3b3b3','#ce62d5'];

		for(var i = 0; i < outputdata.length; i++){
			if(outputdata[i].inpie){
				piedata.push({'value':outputdata[i].val,'color':outputcols[loopcol],'highlight':outputhicols[loopcol],'label':outputdata[i].label});
				loopcol++;
			}
			outputtarg.append(outputdt.clone().html(outputdata[i].label));
			if(i > 0){
				outputtarg.append(outputdd.clone().html('&pound;' + outputdata[i].val).css('color',outputcols[loopcol - 1]));
			}
			else {
				outputtarg.append(outputdd.clone().html('<span>&pound;</span>' + outputdata[i].val));
			}
		}
		Chart.defaults.global.responsive = true;
		/* https://github.com/nnnick/Chart.js/issues/777 */
		//Chart.defaults.global.tooltipTemplate = "<%=label%>: <%= numeral(value).format('(00[.]00)') %> - <%= numeral(circumference / 6.283).format('(0[.][00]%)') %>"; //show tooltips as percentage
		Chart.defaults.global.tooltipTemplate = "<%=label%>: <%= numeral(circumference / 6.283).format('(0[.][00]%)') %>"; //show tooltips as percentage
		var ctx = jQuery('#myChart').get(0).getContext('2d');
		//reset the canvas element in case this is not the first time through the process
		if(app.graph){
			app.graph.destroy();
		}
		app.graph = new Chart(ctx).Pie(piedata);
	},


	//calculate personal allowance
	calculatePersonalAllowance: function(salary,age,blind,taxyear){
		var pa = 10600;
		if(taxyear === '2014/15'){
			pa = 10000;
			if(age >= app.dateDiff()){
				pa = 10660;
			}
		}
		//console.log('initial pa calc is',pa);
		//var calculatedpa = 0;
		var adjusted;
		//PA drops by 1 for every 2 that your adjusted net income is above 100,000. This means your allowance is zero if your income is 122,000 or above.
		if(salary > 100000){
			adjusted = salary - 100000; //e.g. 22,000
			adjusted = adjusted / 2;
			pa = Math.max(pa - adjusted,0);
		}
		/*
		if(salary >= 27700){
			if(salary >= 27820){
				calculatedpa = pa;
			}
			else {
				adjusted = (salary - 27700) / 2;
				calculatedpa = pa - adjusted;
			}
		}
		else {
			calculatedpa = pa;
		}
		*/
		if(blind){
			pa += 2290;
		}
		//console.log('final pa is:',pa);
		return(pa);
	},

	//calculate child care contributions
	calculateChildcare: function(childcarevouchers,elchildcaretype){
		var amt = 0;
		if(parseInt(elchildcaretype.val()) === 2){
			amt = childcarevouchers * 12; //if monthly
		}
		else {
			amt = childcarevouchers * 52; //if weekly
		}
		return(amt);
	},
	
	//calculate pension
	calculatePension: function(elpensiontype,grossincome,pensionraw){
		//console.log('calculatePension',elpensiontype,elpensiontype.val(),grossincome,pensionraw);
		var pensionpercent = 0;
		var pensionamount = 0;
		//if they've entered a percentage
		if(parseInt(elpensiontype.val()) === 2){
			//console.log('Pension is %',pensionraw);
			pensionamount = (grossincome / 100) * pensionraw;
			pensionpercent = pensionraw;
		}
		//if they've entered an amount
		else {
			//calculate percent from amount given
			pensionamount = pensionraw * 12; //multiply pension by 12 months
			pensionpercent = (pensionraw / grossincome) * 100;
		}
		//console.log('pension amount:',pensionamount,'percent:',pensionpercent);
		return([pensionamount,pensionpercent]);
	},
	

	//calculate student loan repayments, multiplies up for 12 months
	calculateStudentLoan: function(salary){
		var threshold = 17335;
		var amount = Math.max(salary - threshold,0);
		if(amount > 0){
			amount = (amount / 100) * 9;
		}
		return(amount);
		/*
		var brackets = [17500,21000,24000,27000,30000];
		var amounts = [1,27,49,72,94];
		for(var i = brackets.length; i > 0; i--){
			if(salary >= brackets[i]){
				return(amounts[i] * 12);
			}
		}
		return(0);
		*/
	},

	//calculate and return national interest paid
	calculateNatins: function(grossincome,deductions,childcarevouchers){
		//console.log('national insurance',grossincome,deductions,childcarevouchers);
		grossincome = grossincome - deductions - childcarevouchers;
		var natbrackets = [8064,42384,100000000]; //the last bracket is fictional and just there to stop the loop below ending too early
		var natpercents = [0,12,2];
		var natins = 0;
		var thisbracket = 0;
		var previousbracket = 0;
		var remainingincome = grossincome;
		var loopcount;
		/*
			if income less than 8060, natins is 0
			else
				pay 12% between 8060 and 42386
				then 2% after that
		*/
		if(grossincome > natbrackets[0]){
			for(var i = 0; i < natbrackets.length; i++){
				loopcount = i;
				if(i > 0){
					previousbracket = natbrackets[i - 1];
				}
				if(grossincome > natbrackets[i]){
					thisbracket = ((natbrackets[i] - previousbracket - 1) / 100) * natpercents[i]; //FIXME why must we subtract 1 as well?
					//console.log('natins paying ',thisbracket,' on ',natbrackets[i]);
					remainingincome -= (natbrackets[i] - previousbracket);
					natins += thisbracket;
				}
				else {
					break;
				}
			}
			if(remainingincome > 0){
				//console.log(loopcount,'NI of',natpercents[loopcount],'% on the remaining ', remainingincome,' gives: ',(remainingincome / 100) * natpercents[loopcount]);
				natins += (remainingincome / 100) * natpercents[loopcount];
			}
		}
		//console.log('Natins: ',natins);
		return(natins);
	},

	calculateNatinsSelfEmployed: function(profits,taxyear){
		/* 2015/2016
			Class 2 if your profits are 5965 or more a year, 2.80 a week
			Class 4 if your profits are 8060 or more a year,
				9% on profits between 8060 and 42385
				2% on profits over 42385

			2014/2015

			Class 2 if your profits are 5965 or more a year, 2.75 a week
			Class 4 if your profits are 7956 or more a year,
				9% on profits between 7956 and 41865
				2% on profits over 41865
		*/
		console.log('nat ins on',profits);
		var brackets = [5965,7956,41865];
		//var percents = [2.75,9,2]; //the first percent isn't a percent, it's an amount per week FIXME don't remember what this was referring to
		var thingwedontknow = 2.75;
		var percents = [0,9,2];
		var natins = 0;
		var thisbracket = 0;
		var previousbracket = 0;
		var remainingincome = profits;
		var loopcount;

		if(taxyear === '2015/16'){
			brackets = [5965,8060,42385];
			//percents = [2.80,9,2];
			percents = [0,9,2];
			thingwedontknow = 2.80;
		}
		if(profits > brackets[0]){
			//class 2
			//natins = percents[0] * 52; //FIXME this could be the amount per week referred to above, should be 2.75 * 52?
			//natins = thingwedontknow * 52;
			console.log('paying',natins,'on the first bit');
			//class 4
			//we're going to have to do this manually, it seems
			remainingincome = profits - brackets[1];
			if(profits < brackets[2]){
				var tmp = (remainingincome / 100) * percents[1];
				natins += tmp;
				console.log('paying',tmp,'on the remaining',remainingincome);
			}
			else {
				var tmp2 = ((brackets[2] - brackets[1]) / 100) * percents[1];
				natins += tmp2;
				var tmp3 = ((profits - brackets[2]) / 100) * percents[2];
				natins += tmp3;
				console.log('paying',tmp2,'on the next bracket',tmp3,'on the next');
			}
		}
		console.log('Natins: ',natins);
		return(natins);
	},

	//FIXME calculate tax on dividends
	calculateDividendTax: function(dividends,taxyear){
		dividends = dividends * (10/9); //this provides the gross dividend amount, including a tax credit.
		var divbrackets = [31865,150000];
		var divpercents = [10,32.5,37.5];
		var divtax = 0;
		var thisbracket = 0;
		var previousbracket = 0;
		var remainingdiv = dividends;
		var loopcount;

		if(taxyear === '2015/16'){
			divbrackets = [31785,150000];
		}

		if(dividends > divbrackets[0]){
			for(var i = 0; i < divbrackets.length; i++){
				loopcount = i;
				if(i > 0){
					previousbracket = divbrackets[i - 1];
				}
				if(dividends > divbrackets[i]){
					thisbracket = ((divbrackets[i] - previousbracket) / 100) * divpercents[i];
					//console.log('dividends paying ',thisbracket,' on ',divbrackets[i]);
					remainingdiv -= (divbrackets[i] - previousbracket);
					divtax += thisbracket;
				}
				else {
					break;
				}
			}
			if(remainingdiv > 0){
				//console.log('divtax of',divpercents[loopcount],'% gives: ',(remainingdiv / 100) * divpercents[loopcount]);
				divtax += (remainingdiv / 100) * divpercents[loopcount];
			}
		}
		//console.log('divtax:',divtax);
		return(divtax);
	},

	//calculate and return tax on a given taxable income value
	//is there an amount below which you don't pay tax? yes, this should have been accounted for by the personal allowance
	calculateIncomeTax: function(taxableincome,married,taxyear,age,extendby){
		//console.log('Taxable income:',taxableincome);
		var taxbrackets = [31785,150000];
		if(taxyear === '2014/15'){
			taxbrackets = [31865,150000];
		}
		//if self employed, pension contributions extend the basic rate tax band. Because this wasn't confusing enough already
		console.log('extendby:',extendby);
		if(extendby > 0){
			for(var t = 0; t < taxbrackets.length; t++){
				taxbrackets[t] = taxbrackets[t] + extendby;
			}
			//taxbrackets[0] = taxbrackets[0] + extendby;
		}
		console.log(taxbrackets);
		var taxpercents = [20,40,45];
		var tax = 0;
		var previousbracket = 0;
		var thisbracket = 0;
		var remainingincome = taxableincome;
		var marriagedeductions = 0;
		var loopcount = 0;

		//you pay x% on the amount between the currentbracket and the next one
		//e.g. between 0 and 31785 you pay 20%
		//between 31785 and 150000 you pay 40%
		//between 150001 and infinity you pay 45%
		
		//this is a simpler, manual version of the loop below
		if(taxableincome > taxbrackets[0]){
			tax = (taxbrackets[0] / 100) * taxpercents[0];
			remainingincome -= taxbrackets[0];
			console.log('tax1 of',tax,'on',taxbrackets[0],'at',taxpercents[0],'remaining',remainingincome);

			if(taxableincome > taxbrackets[1]){
				var nexttax = ((taxbrackets[1] - taxbrackets[0]) / 100) * taxpercents[1];
				tax += nexttax;
				remainingincome -= (taxbrackets[1] - taxbrackets[0]);
				console.log('tax2 of',nexttax,'on',taxbrackets[1],'at',taxpercents[1],'remaining',remainingincome);

				if(remainingincome > 0){
					var finaltax = (remainingincome / 100) * taxpercents[2];
					tax += finaltax;
					console.log('tax3 of',finaltax,'on',remainingincome,'at',taxpercents[2],'remaining',remainingincome);
				}
			}
			else {
				var alttax = (remainingincome / 100) * taxpercents[1];
				tax += alttax;
				console.log('tax2 of',alttax,'on',remainingincome,'at',taxpercents[1],'remaining',remainingincome);
			}
		}
		else {
			tax = (taxableincome / 100) * taxpercents[0];
		}
		console.log('tax:',tax);
		/*
		//this a complex, looping version of the code above that doesn't always work
		for(var i = 0; i < taxbrackets.length; i++){
			loopcount = i;
			if(i > 0){
				previousbracket = taxbrackets[i - 1];
			}
			if(taxableincome > taxbrackets[i]){
				thisbracket = ((taxbrackets[i] - previousbracket) / 100) * taxpercents[i];
				remainingincome -= (taxbrackets[i] - previousbracket);
				console.log('tax paying ',thisbracket,' on ',taxbrackets[i],'(previous: ',previousbracket,')');
				tax += thisbracket;
			}
			else {
				break;
			}
		}
		//console.log('Remaining taxableincome:',remainingincome);
		if(remainingincome > 0){
			var lasttax = (remainingincome / 100) * taxpercents[loopcount];
			console.log(loopcount,i,'Tax of',taxpercents[i],'% on the remaining',remainingincome,'gives',lasttax);
			tax += lasttax;
		}
		*/
		/*
			tax reduction is 10% of allowance
			allowance for 2015/16 is 8355, 2014/15 is 8165
			also decreases by 1 pound for every 2 pound over income limit of 27700 for 2015/16, 27000 for 2014/15
			minimum amount regardless of income is...
				2015/16 allowance is 3220, so 10% is 322
				2014/15 allowance is 3140, so 10% is 314
		*/
		if(age >= app.dateDiff()){
			if(married){
				var marriageallowance;
				var maxmarriage;
				var minmarriage;
				var marriageincomelimit;
				//console.log(taxyear);
				if(taxyear === '2015/16'){
					//console.log('tax year is 2015/16');
					marriageallowance = (8355 / 100) * 10;
					maxmarriage = 835.5;
					minmarriage = 322;
					marriageincomelimit = 27700;
				}
				else { //2014/15
					//console.log('tax year is 2014/15');
					marriageallowance = (8165 / 100) * 10;
					maxmarriage = 816.5;
					minmarriage = 314;
					marriageincomelimit = 27000;
				}
				marriagedeductions = Math.max(Math.min((taxableincome - marriageincomelimit) / 2,maxmarriage),minmarriage);
				//console.log('Marriage deductions:',marriagedeductions);
			}
		}
		//console.log('Tax: ',tax - marriagedeductions,' including marriage ded of ',marriagedeductions);
		tax = Math.max(tax - marriagedeductions,0);
		console.log('Overall calculated income tax:',tax);
		return(tax);
	},

	/* http://stackoverflow.com/questions/1726630/javascript-formatting-number-with-exactly-two-decimals */
	/*
	round2Fixed: function(value) {
		value = +value;
		if (isNaN(value)){
			return NaN;
		}
		// Shift
		value = value.toString().split('e');
		value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + 2) : 2)));
		// Shift back
		value = value.toString().split('e');
		return (+(value[0] + 'e' + (value[1] ? (+value[1] - 2) : -2))).toFixed(2);
	},
	*/
	//going with a simpler option
	round2Fixed: function(value) {
		return(Math.round(value));
	},

	//get the number of years between now and the 6th of April 1938
	dateDiff: function(){
		var birthDay = 6;
		var birthMonth = 4;
		var birthYear = 1938;
		var todayDate = new Date();
		var todayYear = todayDate.getFullYear();
		var todayMonth = todayDate.getMonth();
		var todayDay = todayDate.getDate();
		var age = todayYear - birthYear;
		if (todayMonth < birthMonth - 1){
			age--;
		}
		if (birthMonth - 1 === todayMonth && todayDay < birthDay){
			age--;
		}
		//console.log('dateDiff',age);
		return age;
	},
};

jQuery(document).ready(function() {
    app.init();
});

var testing = {
	// opening screen
	year2014: function(){
	  jQuery('#opt_taxyear').val('2014/15').change();
	},
	year2015: function(){
	  jQuery('#opt_taxyear').val('2015/16').change();
	},
	employed: function(){
	  jQuery('.js-selectemployment[data-target="section-2"] label').click();
	},
	selfemployed: function(){
	  jQuery('.js-selectemployment[data-target="section-3"] label').click();
	},
	gotoStep2: function(){
	  jQuery('.js-nextstep[data-target="section-2"]').click();
	},
	// functions for second page
	inputVal: function(id,amount){
	  jQuery('#' + id).val(amount);
	},
	selectRadio: function(nameof,option){
	  jQuery('[name="' + nameof + '"][value="' + option + '"]').attr('checked',true).change();
	},
	gotoStepFinal: function(){
	  jQuery('.js-nextstep[data-target="section-4"]').click(); //go to the final result
	},
	scenarios: {
		scenario1: function(){
			testing.year2015();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',30000);
			testing.inputVal('opt_empl_bonuses',2000);
			testing.inputVal('opt_empl_age',25);
			testing.selectRadio('opt_empl_blindallow',0); // 1 yes, 0 no 
			testing.inputVal('opt_empl_deductions',0);
			testing.selectRadio('opt_empl_studentloan',0); // 1 yes, 0 no 

			testing.inputVal('opt_empl_childcarevalue',0);
			testing.selectRadio('opt_empl_childcare',1); // 1 weekly, 2 monthly 

			testing.selectRadio('opt_empl_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no 
			testing.inputVal('opt_empl_allowances',0);

			testing.inputVal('opt_empl_pensionvalue',0);
			testing.selectRadio('opt_empl_pension',1); // 1 monthly, 2 percentage 
			testing.gotoStepFinal();
		},
		scenario2: function(){
			testing.year2015();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',10000);
			testing.inputVal('opt_empl_bonuses',0);
			testing.inputVal('opt_empl_age',19);
			testing.selectRadio('opt_empl_blindallow',0); // 1 yes, 0 no 
			testing.inputVal('opt_empl_deductions',0);
			testing.selectRadio('opt_empl_studentloan',0); // 1 yes, 0 no 

			testing.inputVal('opt_empl_childcarevalue',0);
			testing.selectRadio('opt_empl_childcare',1); // 1 weekly, 2 monthly 

			testing.selectRadio('opt_empl_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no 
			testing.inputVal('opt_empl_allowances',0);

			testing.inputVal('opt_empl_pensionvalue',0);
			testing.selectRadio('opt_empl_pension',1); // 1 monthly, 2 percentage 
			testing.gotoStepFinal();
		},
		scenario3: function(){
			testing.year2015();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',100000);
			testing.inputVal('opt_empl_bonuses',15000);
			testing.inputVal('opt_empl_age',34);
			testing.selectRadio('opt_empl_blindallow',0); // 1 yes, 0 no
			testing.inputVal('opt_empl_deductions',1800);
			testing.selectRadio('opt_empl_studentloan',1); // 1 yes, 0 no

			testing.inputVal('opt_empl_childcarevalue',124);
			testing.selectRadio('opt_empl_childcare',2); // 1 weekly, 2 monthly  // in the scenario it says weekly but based on the outputted numbers that looks like a mistake

			testing.selectRadio('opt_empl_married',0); // 1 yes, 0 no
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no
			testing.inputVal('opt_empl_allowances',0);

			testing.inputVal('opt_empl_pensionvalue',275);
			testing.selectRadio('opt_empl_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario4: function(){
			testing.year2015();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',13000);
			testing.inputVal('opt_empl_bonuses',0);
			testing.inputVal('opt_empl_age',64);
			testing.selectRadio('opt_empl_blindallow',1); // 1 yes, 0 no 
			testing.inputVal('opt_empl_deductions',0);
			testing.selectRadio('opt_empl_studentloan',0); // 1 yes, 0 no 

			testing.inputVal('opt_empl_childcarevalue',0);
			testing.selectRadio('opt_empl_childcare',1); // 1 weekly, 2 monthly 

			testing.selectRadio('opt_empl_married',1); // 1 yes, 0 no 
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no 
			testing.inputVal('opt_empl_allowances',0);

			testing.inputVal('opt_empl_pensionvalue',0);
			testing.selectRadio('opt_empl_pension',1); // 1 monthly, 2 percentage 
			testing.gotoStepFinal();
		},
		scenario5: function(){
			testing.year2015();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',200000);
			testing.inputVal('opt_empl_bonuses',50000);
			testing.inputVal('opt_empl_age',29);
			testing.selectRadio('opt_empl_blindallow',0); // 1 yes, 0 no 
			testing.inputVal('opt_empl_deductions',1000);
			testing.selectRadio('opt_empl_studentloan',1); // 1 yes, 0 no

			testing.inputVal('opt_empl_childcarevalue',0);
			testing.selectRadio('opt_empl_childcare',1); // 1 weekly, 2 monthly

			testing.selectRadio('opt_empl_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no
			testing.inputVal('opt_empl_allowances',0);

			testing.inputVal('opt_empl_pensionvalue',5);
			testing.selectRadio('opt_empl_pension',2); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario6: function(){
			testing.year2014();
			testing.employed();
			testing.gotoStep2();
			testing.inputVal('opt_empl_annualsalary',53000);
			testing.inputVal('opt_empl_bonuses',0);
			testing.inputVal('opt_empl_age',42);
			testing.selectRadio('opt_empl_blindallow',0); // 1 yes, 0 no 
			testing.inputVal('opt_empl_deductions',0);
			testing.selectRadio('opt_empl_studentloan',0); // 1 yes, 0 no 

			testing.inputVal('opt_empl_childcarevalue',124);
			testing.selectRadio('opt_empl_childcare',2); // 1 weekly, 2 monthly

			testing.selectRadio('opt_empl_married',1); // 1 yes, 0 no 
			testing.selectRadio('opt_empl_natins',1); // 1 yes, 0 no
			testing.inputVal('opt_empl_allowances',300);

			testing.inputVal('opt_empl_pensionvalue',150);
			testing.selectRadio('opt_empl_pension',1); // 1 monthly, 2 percentage 
			testing.gotoStepFinal();
		},
		scenario7a: function(){
			testing.year2014();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',30000);
			testing.inputVal('opt_self_expenses',12000);
			testing.inputVal('opt_self_age',18);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no 
			testing.selectRadio('opt_self_studentloan',1); // 1 yes, 0 no 
			testing.inputVal('opt_self_benefits',0);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',0);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage 
			testing.gotoStepFinal();
		},
		scenario7b: function(){
			testing.year2015();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',30000);
			testing.inputVal('opt_self_expenses',12000);
			testing.inputVal('opt_self_age',18);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no 
			testing.selectRadio('opt_self_studentloan',1); // 1 yes, 0 no 
			testing.inputVal('opt_self_benefits',0);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',0);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario8: function(){
			testing.year2014();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',10000);
			testing.inputVal('opt_self_expenses',2000);
			testing.inputVal('opt_self_age',24);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no 
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',0);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',0);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		//both scenario 9s have pensions output but no pension value indicated in the details
		scenario9a: function(){
			testing.year2014();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',100000);
			testing.inputVal('opt_self_expenses',25000);
			testing.inputVal('opt_self_age',24);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no 
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',0);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',250);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario9b: function(){
			testing.year2015();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',100000);
			testing.inputVal('opt_self_expenses',25000);
			testing.inputVal('opt_self_age',24);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no 
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no 
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',0);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',250);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		//both scenario 10s have pensions output but no pension value indicated in the details
		scenario10a: function(){
			testing.year2014();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',200000);
			testing.inputVal('opt_self_expenses',30000);
			testing.inputVal('opt_self_age',29);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',1000);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly

			testing.inputVal('opt_self_pensionvalue',5);
			testing.selectRadio('opt_self_pension',2); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario10b: function(){
			testing.year2015();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',200000);
			testing.inputVal('opt_self_expenses',30000);
			testing.inputVal('opt_self_age',29);
			testing.selectRadio('opt_self_married',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_natins',1); // 1 yes, 0 no
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',1000);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',834);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario11a: function(){
			testing.year2014();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',53000);
			testing.inputVal('opt_self_expenses',18000);
			testing.inputVal('opt_self_age',68);
			testing.selectRadio('opt_self_married',1); // 1 yes, 0 no
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_natins',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',1000);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',0);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
		scenario11b: function(){
			testing.year2015();
			testing.selfemployed();
			testing.gotoStep2();
			testing.inputVal('opt_self_income',53000);
			testing.inputVal('opt_self_expenses',18000);
			testing.inputVal('opt_self_age',68);
			testing.selectRadio('opt_self_married',1); // 1 yes, 0 no
			testing.selectRadio('opt_self_blindallow',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_natins',0); // 1 yes, 0 no
			testing.selectRadio('opt_self_studentloan',0); // 1 yes, 0 no
			testing.inputVal('opt_self_benefits',1000);

			testing.inputVal('opt_self_childcarevalue',0);
			testing.selectRadio('opt_self_childcare',1); // 1 weekly, 2 monthly 

			testing.inputVal('opt_self_pensionvalue',0);
			testing.selectRadio('opt_self_pension',1); // 1 monthly, 2 percentage
			testing.gotoStepFinal();
		},
	}
};

/*
Current results
1 - ok (but with rounding errors)
2 - ok (but with rounding errors)
3 - ok (but with rounding errors)
4 - ok (but with rounding errors)
5 - close (income tax out by 3000 for some reason, also rounding errors)
6 - close (income tax out by 200, also rounding errors)
SELF EMPLOYED
7a - close
7b - close
8 - wrong (income tax out by 100)
9a - close
9b - close
10a - close (income tax out by 2000)
10b - close (but income tax out by 5000)
11a - ok
11b - ok

*/
