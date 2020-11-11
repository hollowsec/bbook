import { startOfHour, isBefore, getHours, format } from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import INotificationsRepositoy from '@modules/notifications/repositories/INotificationsRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IRequestDTO {
	provider_id: string;
	user_id: string;
	date: Date;
}

@injectable()
class CreateAppointmentService {
	constructor(
		@inject('AppointmentsRepository')
		private appointmentsRepository: IAppointmentsRepository,

		@inject('NotificationsRepository')
		private notificationsRepository: INotificationsRepositoy,

		@inject('CacheProvider')
		private cacheProvider: ICacheProvider,
	) {}

	public async execute({
		date,
		user_id,
		provider_id,
	}: IRequestDTO): Promise<Appointment> {
		const appointmentDate = startOfHour(date);

		if (isBefore(appointmentDate, Date.now())) {
			throw new AppError("You cant't creat an apppointment on a past date.");
		}

		if (user_id === provider_id) {
			throw new AppError("You cant't create an appointment with yourself");
		}

		if (getHours(appointmentDate) < 8 || getHours(appointmentDate) > 17) {
			throw new AppError(
				'You can only create appointments between 8am and 5pm',
			);
		}

		const findAppointmentInSameDate = await this.appointmentsRepository.findByDate(
			appointmentDate,
			provider_id,
		);

		if (findAppointmentInSameDate) {
			throw new AppError('This appointment is already booked');
		}

		const appointment = await this.appointmentsRepository.create({
			provider_id,
			user_id,
			date: appointmentDate,
		});

		const dateFormatted = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm'h'");

		await this.notificationsRepository.create({
			recipient_id: provider_id,
			content: `Novo Agendamento para o dia ${dateFormatted}`,
		});

		await this.cacheProvider.invalidate(
			`provider-appointments:${provider_id}:${format(
				appointmentDate,
				'yyyy-M-d',
			)}`,
		);

		return appointment;
	}
}

export default CreateAppointmentService;
