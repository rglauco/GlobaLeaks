# API handling recipient user functionalities
import json

from datetime import datetime

from nacl.encoding import Base64Encoder
from sqlalchemy.sql.expression import distinct, func, and_, or_

from globaleaks import models
from globaleaks.handlers.base import BaseHandler
from globaleaks.handlers.recipient.rtip import db_grant_tip_access, db_revoke_tip_access, db_notify_grant_access
from globaleaks.models import serializers
from globaleaks.orm import db_get, db_del, db_log, transact
from globaleaks.rest import requests, errors
from globaleaks.utils.crypto import GCE

import globaleaks.handlers.recipient.export


@transact
def get_receivertips(session, tid, receiver_id, user_key, language, args={}):
    """
    Return list of submissions received by the specified receiver

    :param session: An ORM session
    :param tid: The tenant ID
    :param receiver_id: The receiver ID
    :param user_key: The user key to be used for decrypting data
    :param language: The language to be used during data serialization
    :return: A list of submissions descriptors
    """

    updated_after = datetime.fromtimestamp(int(args.get(b'updated_after', [b'0'])[0]))
    updated_before = datetime.fromtimestamp(int(args.get(b'updated_before', [b'32503680000'])[0]))

    comments_by_itip = {}
    files_by_itip = {}
    receiver_count_by_itip = {}

    # Fetch comments count
    for itip_id, count in session.query(models.InternalTip.id,
                                        func.count(distinct(models.Comment.id))) \
                                 .filter(models.ReceiverTip.receiver_id == receiver_id,
                                         models.ReceiverTip.internaltip_id == models.InternalTip.id,
                                         models.Comment.internaltip_id == models.InternalTip.id,
                                         models.Comment.visibility == 0) \
                                 .group_by(models.InternalTip.id):
        comments_by_itip[itip_id] = count

    # Fetch files count
    for itip_id, count in session.query(models.InternalTip.id,
                                        func.count(distinct(models.InternalFile.id))) \
                                 .filter(models.ReceiverTip.receiver_id == receiver_id,
                                         models.ReceiverTip.internaltip_id == models.InternalTip.id,
                                         models.InternalFile.internaltip_id == models.InternalTip.id) \
                                 .group_by(models.InternalTip.id):
        files_by_itip[itip_id] = count

    # Fetch number of receivers who have access to each report
    for itip_id, count in session.query(models.ReceiverTip.internaltip_id,
                                        func.count(models.ReceiverTip.id)) \
                                 .group_by(models.ReceiverTip.internaltip_id):
        receiver_count_by_itip[itip_id] = count

    # Retrieve all the contexts associated with the current receiver
    receiver_contexts = set()
    for context_id in session.query(models.ReceiverContext.context_id) \
                             .filter(models.ReceiverContext.receiver_id == receiver_id):
        receiver_contexts.add(context_id[0])

    dict_ret = dict()
    # Fetch rtip, internaltip and associated questionnaire schema
    for rtip, itip, answers, data in session.query(models.ReceiverTip,
                                                   models.InternalTip,
                                                   models.InternalTipAnswers,
                                                   models.InternalTipData) \
                                            .join(models.InternalTipData,
                                                  and_(models.InternalTipData.internaltip_id == models.InternalTip.id,
                                                       models.InternalTipData.key == 'whistleblower_identity'),
                                                  isouter=True) \
                                            .filter(or_(models.InternalTip.context_id.in_(receiver_contexts),
                                                    models.ReceiverTip.receiver_id == receiver_id),
                                                    models.InternalTip.update_date >= updated_after,
                                                    models.InternalTip.update_date <= updated_before,
                                                    models.InternalTip.id == models.ReceiverTip.internaltip_id,
                                                    models.InternalTipAnswers.internaltip_id == models.ReceiverTip.internaltip_id) \
                                            .group_by(models.ReceiverTip.id):
        answers = answers.answers
        label = itip.label
        accessible = rtip.receiver_id == receiver_id
        if itip.crypto_tip_pub_key and accessible:
            tip_key = GCE.asymmetric_decrypt(user_key, Base64Encoder.decode(rtip.crypto_tip_prv_key))

            if label:
                label = GCE.asymmetric_decrypt(tip_key, Base64Encoder.decode(label.encode())).decode()

            answers = json.loads(GCE.asymmetric_decrypt(tip_key, Base64Encoder.decode(answers.encode())).decode())
        elif itip.crypto_tip_pub_key:
            # remove useless and unusable crypted data
            answers = ""
            label = ""

        if data is None:
            subscription = 0
        elif data.creation_date == itip.creation_date:
            subscription = 1
        else:
            subscription = 2

        if accessible or itip.id not in dict_ret:
            dict_ret[itip.id] = {
                'id': itip.id,
                'creation_date': itip.creation_date,
                'access_date': rtip.access_date,
                'last_access': itip.last_access,
                'update_date': itip.update_date,
                'expiration_date': itip.expiration_date,
                'reminder_date': itip.reminder_date,
                'progressive': itip.progressive,
                'important': itip.important,
                'label': label,
                'updated': rtip.last_access < itip.update_date,
                'context_id': itip.context_id,
                'tor': itip.tor,
                'answers': answers,
                'score': itip.score,
                'status': itip.status,
                'substatus': itip.substatus,
                'file_count': files_by_itip.get(itip.id, 0),
                'comment_count': comments_by_itip.get(itip.id, 0),
                'receiver_count': receiver_count_by_itip.get(itip.id, 0),
                'subscription': subscription,
                'accessible': accessible
            }

    return list(dict_ret.values())


@transact
def perform_tips_operation(session, tid, user_id, user_cc, operation, args):
    """
    Transaction for performing operation on submissions (grant/revoke)

    :param session: An ORM session
    :param tid: A tenant ID
    :param user_id: A recipient ID
    :param user_cc: A recipient crypto key
    :param operation: An operation command (grant/revoke)
    :param args: The operation arguments
    """
    receiver = db_get(session, models.User, models.User.id == user_id)

    result = session.query(models.InternalTip, models.ReceiverTip) \
                                 .filter(models.ReceiverTip.receiver_id == user_id,
                                         models.InternalTip.id == models.ReceiverTip.internaltip_id,
                                         models.InternalTip.id.in_(args['rtips']))

    if operation == 'grant' and receiver.can_grant_access_to_reports:
        notify = False
        for itip, rtip in result:
            new_receiver, _ = db_grant_tip_access(session, tid, user_id, user_cc, itip, rtip, args['receiver'])
            if new_receiver:
                notify = True
                db_log(session, tid=tid, type='grant_access', user_id=user_id, object_id=itip.id)

        if notify:
            db_notify_grant_access(session, new_receiver)

    elif operation == 'revoke' and receiver.can_grant_access_to_reports:
        for itip, _ in result:
            if db_revoke_tip_access(session, tid, user_id, itip, args['receiver']):
                db_log(session, tid=tid, type='revoke_access', user_id=user_id, object_id=itip.id)


    else:
        raise errors.ForbiddenOperation


class TipsCollection(BaseHandler):
    """

    Handler dealing with submissions fetch
    """
    check_roles = 'receiver'

    def get(self):
        return get_receivertips(self.request.tid,
                                self.session.user_id,
                                self.session.cc,
                                self.request.language,
                                self.request.args)


class Operations(BaseHandler):
    """
    Handler that enables to issue operations on submissions
    """
    check_roles = 'receiver'

    def put(self):
        request = self.validate_request(self.request.content.read(), requests.OpsDesc)

        return perform_tips_operation(self.request.tid,
                                      self.session.user_id,
                                      self.session.cc,
                                      request['operation'],
                                      request['args'])
