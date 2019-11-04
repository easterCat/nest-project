import {
  Controller,
  Get,
  Query,
  Redirect,
  Header,
  Req,
  Param,
  Post,
} from '@nestjs/common';
import * as request from 'request-promise';
import { UserService } from './user.service';
import { SessionService } from '../session/session.service';
import { Request } from 'express';

const sessionTime = 1000 * 60 * 60 * 24;

@Controller('api/user')
export class UserControllerApi {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  @Get('login/:name')
  async login(@Param() paramData: { name: string }) {
    const session = await this.sessionService.find({ name: paramData.name });
    const token = session.token;
    const user = await this.userService.findOneByName(paramData.name);
    const data = { ...user, token };
    return { code: 200, message: '登录成功', data };
  }

  @Post('/logged')
  async logged(@Req() req: Request) {
    const session = await this.sessionService.find({
      token: req.cookies['ptg-token'],
    });
    if (session) {
      if (Number(session.createAt) - +new Date() > sessionTime) {
        return { code: 400, messsage: '登录已过期', data: null };
      }
      const user = await this.userService.findOneByName(session.name);
      if (user) {
        return {
          code: 200,
          message: '已经登录',
          data: { ...user, token: session.token },
        };
      } else {
        return { code: 400, message: '用户不存在', data: null };
      }
    } else {
      return { code: 400, message: '登录已过期', data: null };
    }
  }

  @Get('/oauth')
  @Header('Set-Cookie', 'sessionid=38afes7a8;HttpOnly;')
  @Redirect('/', 301)
  async githubOauth(@Query() quertData: { code: string }) {
    const ClientID = 'Iv1.59ce08097886630e';
    const ClientSecret = 'ff852c46b449001c9ee0bc2ea48c494b9a467c52';
    const config = {
      method: 'post',
      uri:
        'http://github.com/login/oauth/access_token?' +
        `client_id=${ClientID}&` +
        `client_secret=${ClientSecret}&` +
        `code=${quertData.code}`,
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
    };
    const result: string = (await asyncRequest(config)) as string;
    const parseResult = JSON.parse(result);
    const githubConfig = {
      method: 'get',
      uri: `https://api.github.com/user`,
      headers: {
        Authorization: `token ${parseResult.access_token}`,
        'User-Agent': 'easterCat',
      },
    };
    const user: string = (await asyncRequest(githubConfig)) as string;
    const parseUser = JSON.parse(user);

    const find = await this.userService.validateUser(parseUser.name);

    if (!find && parseUser.name !== '') {
      await this.userService.create({
        login: parseUser.login,
        avatarUrl: parseUser.avatar_url,
        name: parseUser.name,
        createdAt: parseUser.created_at,
        updatedAt: parseUser.updated_at,
      });
    }

    const loginStatus = await this.userService.login(parseUser.name);

    await this.sessionService.create({
      token: loginStatus,
      createAt: +Date.now(),
      name: parseUser.name,
    });

    return { url: `/logged?name=${parseUser.name}` };
  }
}

function asyncRequest(config) {
  return new Promise((resolve, reject) => {
    request(config)
      .then(response => {
        resolve(response);
      })
      .catch(error => {
        reject(error);
      });
  });
}
