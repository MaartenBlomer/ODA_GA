const OracleBot = require('@oracle/bots-node-sdk');
const { WebhookClient, WebhookEvent } = OracleBot.Middleware;
const bodyParser = require('body-parser');
const _ = require('underscore');
const JSON = require('circular-json');
// google
const PubSub = require('pubsub-js');
PubSub.immediateExceptions = true;
const { dialogflow, SignIn } = require('actions-on-google');
const assistant = dialogflow({debug: true, clientId:'939250538826-d3fn1eiej3cam1gi3acjoaeoip9lv456.apps.googleusercontent.com',});
var userlocale = '';
var userId = '';

module.exports = (app) => {
  const logger = console;
  // this will add body-parser
  OracleBot.init(app, {
    logger,
  });
  
  // Use this if you only have one Chatbot being called
  const webhook = new WebhookClient({
    channel: {
      url: 'https://botv2frk1I0088H368B86bots-mpaasocimt.botmxp.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-6d466372210e4300bb31f4db15e8e96c/listeners/webhook/channels/c0c9dc89-52b4-42d7-a2ed-bae38dba032f',
      secret: 'JEDCZSUyrCxJsxeY7BKFt8dbTtcY4z45',
    }
  });

    
  webhook
  .on(WebhookEvent.ERROR, err => logger.error('Error:', err.message))
  .on(WebhookEvent.MESSAGE_SENT, message => logger.info('Message to chatbot:', message))
  .on(WebhookEvent.MESSAGE_RECEIVED, message => logger.info('Message from chatbot:', message));
 
  // Need pub/sub storage

  // https://my.ngrok.io/bot/message/es <=== configured this in ODA per channel/locale
  // https://my.ngrok.io/bot/message/pt <=== configured this in ODA per channel/locale
  app.post('/bot/message', webhook.receiver((req, res) => {
    const { locale } = req.params;
    res.sendStatus(200);
     const body = req.body;
     const userId = body.userId;
     logger.info("Publishing to", userId);
     PubSub.publish(userId, req);
  }));

  assistant.intent('Default Welcome Intent', (conv) => {

    userlocale = conv.user.locale;
    logger.info('Welcome user profile payload :', stringify(conv.user.profile));

    if(typeof conv.user.profile.payload == 'undefined') {
      logger.info('Starting Signin process');
      if((userlocale.substring(0,2) === 'en') && (typeof conv.user.storage.userId === 'undefined')){
        userId = self.randomIntInc(1000000, 9999999).toString();
        conv.ask(new SignIn('To get you Google account details, like name and email, answer YES'));
    }
    logger.info('Got out of Signin');
    }else { 
      if (userlocale.substring(0,2) === 'pt') {
        conv.ask('Oiii');
      }
      else if (userlocale.substring(0,2) === 'es') {
        conv.ask('Hola');
      }  
      else if (userlocale.substring(0,2) === 'en') {
        conv.ask('Hi');
      }
    }
  });

  assistant.intent('Default Fallback Intent', (conv) => {
    var channeloc = {
      url: 'https://botv2frk1I0088H368B86bots-mpaasocimt.botmxp.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-6d466372210e4300bb31f4db15e8e96c/listeners/webhook/channels/c0c9dc89-52b4-42d7-a2ed-bae38dba032f',
      secret: 'JEDCZSUyrCxJsxeY7BKFt8dbTtcY4z45',
    };
    logger.info('Got query : ', conv.query);

    userlocale = conv.user.locale;
    if (userlocale.substring(0,2) === 'es') {userlocale = 'es-419'};

    if (typeof conv.user.profile.payload === 'undefined') {
       userId = conv.user.storage.userId; 
       userName = '';
    } else {
      userpayload = conv.user.profile.payload;
      userId = userpayload.sub;
      userName = userpayload.given_name;
    }   
    logger.info('Channel being used: ', channeloc);

    return new Promise(function (resolve, reject) {
      const MessageModel = webhook.MessageModel();

      var additionalProperties = {
        profile: {
          clientType: "google",
          locale: userlocale			
        }
      };
      var messagePayload = MessageModel.textConversationMessage(conv.query);
      const message = _.assign({ userId, messagePayload }, additionalProperties);
      
      var treatandsendtoGoogle =  function (msg, data) {
        conv.user.storage.userId = userId;
        var texto1 = '';
        var texto2 = '';
        texto1 = data.body.messagePayload.text;
 // usually my messages sent from Chatbot have a text and some actions (options I give to the user)
        if (data.body.messagePayload.actions){
            texto2 = actionsToText(data.body.messagePayload.actions,texto1);
            texto1 = '';
        }
        logger.info('text 2 ', JSON.stringify(texto2));
        PubSub.unsubscribe(userId);
        if (typeof data.body.messagePayload.channelExtensions === 'undefined') {
          conv.ask('<speak>'+texto1+texto2+'</speak>');
        }
        else {
          conv.close('<speak>'+texto1+texto2+'</speak>');
        }
        resolve();
      };		
 	  
	    PubSub.subscribe(userId, treatandsendtoGoogle)	  
      webhook.send(message, channeloc)
      .catch(err => {
        logger.info('Failed sending message to Bot');
        if (userlocale.substring(0,2) === 'pt') {
            conv.close('Houve falha no envio da mensagem ao Chatbot. Por favor, revise a configuração do seu Chatbot.');
        }
    // if Spanish - send message of error in Spanish
        else if (userlocale.substring(0,2) === 'es')  {
            conv.close('Tuvimos un error en el envio del mensaje al Chatbot. Por favor, revise la configuración de su Chatbot.');
        }
        else {
            conv.close('Failed sending message to Bot.  Please review your bot configuration.');
        }
        reject(err);
        PubSub.unsubscribe(userId);
      })
    })  
  });

  assistant.intent('SIGN_IN',(conv, params, signin) => {
    logger.info('Received the return and will verify Userid');

    if (signin.status === 'OK') {
      userlocale = conv.user.locale;
      userpayload = conv.user.profile.payload;
      userId = userpayload.sub;
      logger.info('This is users userId: ', userId);
      userName = userpayload.given_name;

    if (userlocale.substring(0,2) === 'en') {
        conv.ask('Hi ' + userName + ', what Can I do for you?');
      }
    } else {
      userlocale = conv.user.locale;
      if (userlocale.substring(0,2) === 'en') {
        conv.ask('Hi, as you did not let me access your details, during the process I will have to ask for some information, what can I do for you?');
      }
    }
  });

  assistant.intent('Cancel', (conv) => {
    userlocale = conv.user.locale;
    logger.info('user profile payload: ', stringify(conv.user.profile));

    if (typeof conv.user.profile.payload === 'undefined') {
       userId = conv.user.storage.userId; 
       userName = '';
    } else {
      userpayload = conv.user.profile.payload;
      userId = userpayload.sub;
      userName = userpayload.given_name;
    }   
    logger.info('I am in Cancel Intent - This is users User ID: ', userId);
    logger.info('Channel being used: ', channeloc);
    return new Promise(function (resolve, reject) {
      const MessageModel = webhook.MessageModel();

      var additionalProperties = {
        profile: {
          clientType: "google",
          locale: userlocale			
        }
      };
      var messagePayload = MessageModel.textConversationMessage('cancel');
      const message = assign({ userId, messagePayload }, additionalProperties);
      var treatandsendtoGoogle =  function (msg, data) {
      var texto1 = '';
      var texto2 = '';
      texto1 = data.body.messagePayload.text;
          
      if (data.body.messagePayload.actions){
          texto2 = actionsToText(data.body.messagePayload.actions,texto1);
          texto1 = '';
      }
        PubSub.unsubscribe(userId);
        conv.close('<speak>'+texto1+texto2+'</speak>');
        resolve();
      };		
 	  
	    PubSub.subscribe(userId, treatandsendtoGoogle)	  
      webhook.send(message, channeloc)
      .catch(err => {
        logger.info('Failed sending message to Bot');
        conv.ask('Failed sending message to Bot.  Please review your bot configuration.');
        reject(err);
        PubSub.unsubscribe(userId);
      });
    });
  });

  function trailingPeriod(text) {
    if (!text || (typeof text !== 'string')) {
      return '';
    }
    return ((text.trim().endsWith('.') || text.trim().endsWith('?') || text.trim().endsWith(',')) ? text.trim() + ' ' : text.trim() + '. ');
  }
  
  function actionToText(action, actionPrefix) {
    var actionText = (actionPrefix ? actionPrefix + ' ' : '');
    if (action.label) {
      return actionText + action.label;
    }
    else {
      switch (action.type) {
      case 'postback':
        break;
      case 'call':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Chame o fone de numero ' + action.phoneNumber;
        }
        else if (userlocale.substring(0,2) === 'es') {
          actionText += 'Llame el telefono con numero ' + action.phoneNumber;
        }
        else if (userlocale.substring(0,2) === 'en')  {
          actionText += 'Call the telephone with number ' + action.phoneNumber;
        }
        break;
      case 'url':
        if (userlocale.substring(0,2) === 'pt-BR') {
          actionText += 'Abra a URL ' + action.url;
        }
        else if (userlocale.substring(0,2) === 'es-ES')  {
          actionText += 'Abra el sitio URL ' + action.url;
        }
        else if (userlocale.substring(0,2) === 'en-US')  {
          actionText += 'Open the URL ' + action.url;
        }
        break;
      case 'share':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Compartilhe a mensagem ';
        }
        else if (userlocale.substring(0,2) === 'es') {
          actionText += 'Compartille el mensaje ';
        }  
        else if (userlocale.substring(0,2) === 'en') {
          actionText += 'Share the Message ';
        }              
        break;
      case 'location':
        if (userlocale.substring(0,2) === 'pt') {
          actionText += 'Compartilhe a localização ';
        }
        else if (userlocale.substring(0,2) === 'es')  {
          actionText += 'Compartille la ubicación ';
        }  
        else if (userlocale.substring(0,2) === 'en')  {
          actionText += 'Share the location ';        
        }              
        break;
      default:
        break;
      }
    }
    return actionText;
  }
  
  function actionsToText(actions, prompt, actionPrefix) {
    if (userlocale.substring(0,2) === 'pt') {
      var actionsText = prompt || 'Voce pode escolher das seguintes ações: ';
    }
    else if (userlocale.substring(0,2) === 'es')  {
      var actionsText = prompt || 'Tu puedes escojer de las seguientes opciones: ';
    }
    else if (userlocale.substring(0,2) === 'en')  {
      var actionsText = prompt || 'You can choose from the following actions: ';
    }
    actions.forEach(function (action, index) {
      actionsText = actionsText + actionToText(action, actionPrefix);
      if (index < actions.length - 1) {
        actionsText = actionsText + ', ';
      }
    });
    return trailingPeriod(actionsText);
  }

  // Webhook for google with use the google parser and assistant 
  app.use('fulfillment',json(),assistant);
  app.post('/fulfillment', assistant );
}

// can remove body-parser
