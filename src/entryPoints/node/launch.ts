import childProcess = require("child_process");

import path = require("path");

import {
    IClientConnection,
    IValidationReport,
    IOpenedDocument,
    StructureNodeJSON,
    Suggestion
} from '../../client/client'

import {
    MessageDispatcher,
    ProtocolMessage,
    MessageToServerType
} from './protocol'

import {
    IChangedDocument,
    MessageSeverity
} from "../../common/typeInterfaces";


let clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

function launch() : IClientConnection {

    let serverProcess = (<any>childProcess).fork(path.resolve(__dirname, './serverProcess.js'), [], {
        silent: true
    });

    return new NodeProcessClientConnection(serverProcess);
}

class NodeProcessClientConnection extends MessageDispatcher<MessageToServerType> implements IClientConnection {

    private validationReportListeners : {(report:IValidationReport):void}[] = [];

    constructor(private serverProcess : childProcess.ChildProcess){
        super();

        serverProcess.on('message', (serverMessage: ProtocolMessage<MessageToServerType>) => {
            this.handleRecievedMessage(serverMessage);
        });

        serverProcess.stdout.on('data', data => {
            this.debug("Server process stdout:\n" + data.toString(), "NodeProcessClientConnection");
        });

        serverProcess.stderr.on('data', data => {
            this.debug("Server process stderr:\n" + data.toString(), "NodeProcessClientConnection");
        });

        serverProcess.on('close', function (code) {
            this.debug('Validation process exited with code ' + code, "NodeProcessClientConnection");
        });
    }

    stop() : void {
        this.serverProcess.kill();
    }

    onValidationReport(listener : (report:IValidationReport)=>void) {
        this.validationReportListeners.push(listener);
    }

    documentOpened(document: IOpenedDocument) : void {
        this.send({
            type : "OPEN_DOCUMENT",
            payload : document
        })
    }

    documentChanged(document: IChangedDocument) : void {
        this.send({
            type : "CHANGE_DOCUMENT",
            payload : document
        })
    }

    documentClosed(uri : string) : void {
        this.send({
            type : "CLOSE_DOCUMENT",
            payload : uri
        })
    }

    getStructure(uri: string) : Promise<{[categoryName:string] : StructureNodeJSON}> {

        return this.sendWithResponse({
            type : "GET_STRUCTURE",
            payload : uri
        });
    }

    getSuggestions(uri: string, position: number) : Promise<Suggestion[]> {
        return this.sendWithResponse({
            type : "GET_SUGGESTIONS",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    VALIDATION_REPORT(report : IValidationReport) : void {
        for (let listener of this.validationReportListeners) {
            listener(report);
        }
    }

    sendMessage
        (message : ProtocolMessage<MessageToServerType>) : void {

        this.serverProcess.send(message);
    }

    /**
     * Logs a message
     * @param message - message text
     * @param severity - message severity
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    log(message:string, severity: MessageSeverity,
        component?: string, subcomponent?: string) : void {

        let toLog = "";
        if (severity != MessageSeverity.WARNING && severity != MessageSeverity.ERROR) {
            MessageSeverity[severity];
        }

        if (component) toLog+= (component + ": ")
        if (subcomponent) toLog+= (subcomponent + ": ")

        toLog += message;

        if (severity == MessageSeverity.WARNING) {
            console.warn(toLog);
        } else if (severity == MessageSeverity.ERROR) {
            console.error(toLog);
        } else {
            console.log(toLog);
        }
    }

    /**
     * Logs a DEBUG severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debug(message:string,
          component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG, component, subcomponent);
    }

    /**
     * Logs a DEBUG_DETAIL severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugDetail(message:string,
                component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG_DETAIL, component, subcomponent);
    }

    /**
     * Logs a DEBUG_OVERVIEW severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugOverview(message:string,
                  component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG_OVERVIEW, component, subcomponent);
    }

    /**
     * Logs a WARNING severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    warning(message:string,
            component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.WARNING, component, subcomponent);
    }

    /**
     * Logs an ERROR severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    error(message:string,
          component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.ERROR, component, subcomponent);
    }
}

