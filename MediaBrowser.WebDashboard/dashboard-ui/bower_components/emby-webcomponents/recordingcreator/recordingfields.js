﻿define(['globalize', 'connectionManager', 'require', 'loading', 'apphost', 'recordingHelper', 'emby-toggle'], function (globalize, connectionManager, require, loading, appHost, recordingHelper) {

    function getRegistration(apiClient, programId, feature) {

        loading.show();

        return apiClient.getJSON(apiClient.getUrl('LiveTv/Registration', {

            ProgramId: programId,
            Feature: feature

        })).then(function (result) {

            loading.hide();
            return result;

        }, function () {

            loading.hide();

            return {
                TrialVersion: true,
                IsValid: true,
                IsRegistered: false
            };
        });
    }

    function showConvertRecordingsUnlockMessage(context, apiClient) {

        apiClient.getPluginSecurityInfo().then(function (regInfo) {

            if (regInfo.IsMBSupporter) {
                context.querySelector('.convertRecordingsContainer').classList.add('hide');
            } else {
                context.querySelector('.convertRecordingsContainer').classList.remove('hide');
            }

        }, function () {

            context.querySelector('.convertRecordingsContainer').classList.remove('hide');
        });
    }

    function showSeriesRecordingFields(context, programId, apiClient) {

        getRegistration(apiClient, programId, 'seriesrecordings').then(function (regInfo) {

            if (regInfo.IsRegistered) {
                context.querySelector('.supporterContainer').classList.add('hide');
                context.querySelector('.convertRecordingsContainer').classList.add('hide');

            } else {

                context.querySelector('.supporterContainerText').innerHTML = globalize.translate('sharedcomponents#MessageActiveSubscriptionRequiredSeriesRecordings');
                context.querySelector('.supporterContainer').classList.remove('hide');
                context.querySelector('.convertRecordingsContainer').classList.add('hide');
            }
        });
    }

    function showSingleRecordingFields(context, programId, apiClient) {

        getRegistration(apiClient, programId, 'dvr').then(function (regInfo) {

            if (regInfo.IsRegistered) {
                context.querySelector('.supporterContainer').classList.add('hide');
                showConvertRecordingsUnlockMessage(context, apiClient);
            } else {

                context.querySelector('.supporterContainerText').innerHTML = globalize.translate('sharedcomponents#DvrSubscriptionRequired');
                context.querySelector('.supporterContainer').classList.remove('hide');
                context.querySelector('.convertRecordingsContainer').classList.add('hide');
            }
        });
    }

    function showRecordingFieldsContainer(context, programId, apiClient) {

        getRegistration(apiClient, programId, 'dvr').then(function (regInfo) {

            if (regInfo.IsRegistered) {
                context.querySelector('.recordingFields').classList.remove('hide');
            } else {

                context.querySelector('.recordingFields').classList.add('hide');
            }
        });
    }

    function loadData(parent, program, apiClient) {

        if (program.IsSeries) {
            parent.querySelector('.chkRecordSeriesContainer').classList.remove('hide');
        } else {
            parent.querySelector('.chkRecordSeriesContainer').classList.add('hide');
        }

        parent.querySelector('.chkRecord').checked = program.TimerId != null;
        parent.querySelector('.chkRecordSeries').checked = program.SeriesTimerId != null;

        if (program.SeriesTimerId != null) {
            showSeriesRecordingFields(parent, program.Id, apiClient);
        } else {
            showSingleRecordingFields(parent, program.Id, apiClient);
        }

        //var seriesTimerPromise = program.SeriesTimerId ?
        //    apiClient.getLiveTvSeriesTimer(program.SeriesTimerId) :
        //    apiClient.getLiveTvProgram(program.Id, apiClient.getCurrentUserId());

        //seriesTimerPromise.then(function (seriesTimer) {

        //});
    }

    function fetchData(instance) {

        var options = instance.options;
        var apiClient = connectionManager.getApiClient(options.serverId);

        showRecordingFieldsContainer(options.parent, options.programId, apiClient);

        return apiClient.getLiveTvProgram(options.programId, apiClient.getCurrentUserId()).then(function (program) {

            instance.TimerId = program.TimerId;
            instance.SeriesTimerId = program.SeriesTimerId;

            loadData(options.parent, program, apiClient);
        });
    }

    function recordingEditor(options) {
        this.options = options;
        this.embed();
    }

    function onSupporterButtonClick() {
        if (appHost.supports('externalpremium')) {
            shell.openUrl('https://emby.media/premiere');
        } else {

        }
    }

    function onRecordChange(e) {

        this.changed = true;

        var self = this;
        var options = this.options;
        var apiClient = connectionManager.getApiClient(options.serverId);

        var isChecked = e.target.checked;

        if (e.target.checked) {
            if (!this.TimerId && !this.SeriesTimerId) {
                recordingHelper.createRecording(apiClient, options.programId, false).then(function () {
                    fetchData(self);
                });
            }
        } else {
            if (this.TimerId) {
                recordingHelper.cancelTimer(apiClient, this.TimerId, true).then(function () {
                    fetchData(self);
                });
            }
        }
    }

    function onRecordSeriesChange(e) {

        this.changed = true;

        var self = this;
        var options = this.options;
        var apiClient = connectionManager.getApiClient(options.serverId);

        var isChecked = e.target.checked;

        if (e.target.checked) {
            showSeriesRecordingFields(options.parent, options.programId, apiClient);

            if (!this.SeriesTimerId) {

                var promise = this.TimerId ?
                    recordingHelper.changeRecordingToSeries(apiClient, this.TimerId, options.programId) :
                    recordingHelper.createRecording(apiClient, options.programId, true);

                promise.then(function () {
                    fetchData(self);
                });
            }
        } else {

            showSingleRecordingFields(options.parent, options.programId, apiClient);

            if (this.SeriesTimerId) {
                apiClient.cancelLiveTvSeriesTimer(this.SeriesTimerId).then(function () {
                    fetchData(self);
                });
            }
        }
    }

    recordingEditor.prototype.embed = function () {

        var self = this;

        return new Promise(function (resolve, reject) {

            require(['text!./recordingfields.template.html'], function (template) {

                var options = self.options;
                var context = options.parent;
                context.innerHTML = globalize.translateDocument(template, 'sharedcomponents');

                var supporterButtons = context.querySelectorAll('.btnSupporter');
                for (var i = 0, length = supporterButtons.length; i < length; i++) {
                    if (appHost.supports('externalpremium')) {
                        supporterButtons[i].classList.remove('hide');
                    } else {
                        supporterButtons[i].classList.add('hide');
                    }
                    supporterButtons[i].addEventListener('click', onSupporterButtonClick);
                }

                context.querySelector('.chkRecord').addEventListener('change', onRecordChange.bind(self));
                context.querySelector('.chkRecordSeries').addEventListener('change', onRecordSeriesChange.bind(self));

                fetchData(self).then(resolve);
            });
        });
    };

    recordingEditor.prototype.hasChanged = function () {

        return this.changed;
    };

    return recordingEditor;
});